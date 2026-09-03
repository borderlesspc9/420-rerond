"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnaliseJob = runAnaliseJob;
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const openaiService_1 = require("./openaiService");
const normasService_1 = require("./normasService");
const prompts_1 = require("../config/prompts");
const concessionariaProfiles_1 = require("../config/concessionariaProfiles");
const consistencyAnalyzer_1 = require("./consistencyAnalyzer");
const concessionariaPerfilService_1 = require("./concessionariaPerfilService");
const MAX_PDFS_PROJETO = 10;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const VALID_TIPOS = ["pit", "obra_per", "obra_nao_per"];
const storage = (0, storage_1.getStorage)();
function isValidTipo(value) {
    return typeof value === "string" && VALID_TIPOS.includes(value);
}
async function updateJob(jobRef, solicitacaoRef, state, progress, stage, extra = {}) {
    const payload = {
        state,
        progress,
        stage,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        ...extra,
    };
    await jobRef.update(payload);
    await solicitacaoRef.update({
        analiseJobStatus: state,
        analiseJobProgress: progress,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function downloadStorageFile(url) {
    const bucket = storage.bucket();
    if (url.includes("firebasestorage.googleapis.com") || url.includes("storage.googleapis.com")) {
        const decodedUrl = decodeURIComponent(url);
        const pathMatch = decodedUrl.match(/\/o\/(.+?)(\?|$)/);
        if (pathMatch) {
            const [buffer] = await bucket.file(pathMatch[1]).download();
            return buffer;
        }
    }
    if (url.startsWith("gs://")) {
        const withoutPrefix = url.replace(/^gs:\/\/[^/]+\//, "");
        const [buffer] = await bucket.file(withoutPrefix).download();
        return buffer;
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Falha ao baixar arquivo: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
}
function extractFilenameFromUrl(url) {
    try {
        const decoded = decodeURIComponent(url);
        const segments = decoded.split("/");
        return segments[segments.length - 1]?.split("?")[0] || "documento.pdf";
    }
    catch {
        return "documento.pdf";
    }
}
function parseArquivosMeta(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => item && typeof item === "object")
        .map((item) => {
        const raw = item;
        return {
            url: String(raw.url ?? ""),
            nome: String(raw.nome ?? ""),
            tipoDocumento: raw.tipoDocumento ? String(raw.tipoDocumento) : "desconhecido",
        };
    })
        .filter((item) => item.url);
}
function buildDocumentoProjetoLabel(filename, arquivosMeta, url) {
    const meta = arquivosMeta.find((m) => m.url === url || m.nome === filename);
    const tipo = meta?.tipoDocumento ?? "desconhecido";
    const nome = meta?.nome ?? filename;
    return `[DOCUMENTO DO PROJETO: tipoDocumento=${tipo}; arquivo=${nome}]`;
}
function aplicarLimitesPdf(pdfBuffers) {
    const incluidos = [];
    const omitidos = [];
    for (const pdf of pdfBuffers) {
        if (incluidos.length >= MAX_PDFS_PROJETO) {
            omitidos.push(`${pdf.filename} (limite de ${MAX_PDFS_PROJETO} PDFs)`);
            continue;
        }
        if (pdf.buffer.length > MAX_PDF_SIZE_BYTES) {
            omitidos.push(`${pdf.filename} (tamanho excedido)`);
            continue;
        }
        incluidos.push(pdf);
    }
    return { incluidos, omitidos };
}
function stripMarkdownFence(raw) {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json"))
        cleaned = cleaned.slice(7);
    else if (cleaned.startsWith("```"))
        cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```"))
        cleaned = cleaned.slice(0, -3);
    return cleaned.trim();
}
function parseAIResponse(raw) {
    const candidates = [raw.trim(), stripMarkdownFence(raw)];
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(raw.slice(firstBrace, lastBrace + 1).trim());
    }
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (!parsed || typeof parsed !== "object")
                continue;
            return {
                checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
                parecerTecnico: typeof parsed.parecerTecnico === "string" ? parsed.parecerTecnico : "Parecer não gerado.",
                dadosExtraidos: parsed.dadosExtraidos && typeof parsed.dadosExtraidos === "object"
                    ? parsed.dadosExtraidos
                    : null,
                conferenciaInputs: Array.isArray(parsed.conferenciaInputs)
                    ? parsed.conferenciaInputs
                    : [],
            };
        }
        catch {
            // próximo candidato
        }
    }
    throw new Error("A IA retornou texto em vez de JSON estruturado.");
}
async function inferTipoRelatorio(pdfBuffers) {
    const parts = [];
    for (const pdf of pdfBuffers.slice(0, 2)) {
        parts.push((0, openaiService_1.buildFileInput)(pdf.filename, pdf.buffer));
    }
    parts.push((0, openaiService_1.buildTextInput)((0, prompts_1.buildInferTipoPrompt)()));
    const result = await (0, openaiService_1.analyze)(parts, { maxOutputTokens: 50, temperature: 0 });
    const inferred = result.content.trim().toLowerCase();
    if (isValidTipo(inferred))
        return inferred;
    if (inferred.includes("pit"))
        return "pit";
    if (inferred.includes("nao_per"))
        return "obra_nao_per";
    if (inferred.includes("per"))
        return "obra_per";
    return "pit";
}
async function runAnaliseJob(params) {
    const db = (0, firestore_1.getFirestore)();
    const COLLECTION = params.collection?.trim() || "solicitacoes";
    const solicitacaoRef = db.collection(COLLECTION).doc(params.solicitacaoId);
    const jobRef = solicitacaoRef.collection("analiseJobs").doc(params.jobId);
    (0, openaiService_1.initOpenAI)(params.apiKey);
    try {
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new Error("Job de análise não encontrado.");
        }
        const jobData = jobSnap.data();
        if (jobData.state !== "queued") {
            console.log(`Job ${params.jobId} ignorado (state=${jobData.state})`);
            return;
        }
        await jobRef.update({ startedAt: firestore_1.FieldValue.serverTimestamp() });
        await solicitacaoRef.update({
            status: "em_analise",
            activeAnaliseJobId: params.jobId,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const snapshot = await solicitacaoRef.get();
        if (!snapshot.exists)
            throw new Error("Solicitação não encontrada.");
        const data = snapshot.data();
        const escopoAnalise = (jobData.escopoAnalise ?? {});
        const tiposProjetoPraComparar = Array.isArray(jobData.tiposProjetoPraComparar)
            ? jobData.tiposProjetoPraComparar.filter((item) => isValidTipo(item))
            : [];
        const promptCustomizado = typeof jobData.promptCustomizado === "string" ? jobData.promptCustomizado.trim() : "";
        const arquivos = Array.isArray(data.arquivos) ? data.arquivos : [];
        const arquivosMeta = parseArquivosMeta(data.arquivosMeta);
        const concessionariaId = data.concessionariaId ? String(data.concessionariaId) : null;
        const perfilFirestore = await (0, concessionariaPerfilService_1.getConcessionariaPerfilFromFirestore)(concessionariaId);
        const promptProfileFromFirestore = perfilFirestore?.promptProfile &&
            ["eco101", "motiva", "arteris"].includes(perfilFirestore.promptProfile)
            ? perfilFirestore.promptProfile
            : null;
        const promptProfileRaw = promptProfileFromFirestore ?? (0, concessionariaProfiles_1.resolveConcessionariaPromptProfile)(concessionariaId);
        const promptProfile = promptProfileRaw === "custom" ? "default" : promptProfileRaw;
        const isProfile = (0, concessionariaProfiles_1.isProfileConcessionaria)(concessionariaId) || Boolean(perfilFirestore?.perfilCompleto);
        await updateJob(jobRef, solicitacaoRef, "extracting", 28, "pdfs");
        const pdfUrls = arquivos.filter((url) => url.toLowerCase().includes(".pdf"));
        const pdfBuffersRaw = [];
        for (const url of pdfUrls) {
            try {
                const buffer = await downloadStorageFile(url);
                pdfBuffersRaw.push({
                    filename: extractFilenameFromUrl(url),
                    buffer,
                    url,
                });
            }
            catch (err) {
                console.error(`Erro ao baixar PDF: ${url}`, err);
            }
        }
        const { incluidos: pdfBuffers, omitidos: pdfsOmitidos } = aplicarLimitesPdf(pdfBuffersRaw);
        let tipoBase;
        if (isValidTipo(data.tipoRelatorio)) {
            tipoBase = data.tipoRelatorio;
        }
        else if (pdfBuffers.length > 0) {
            tipoBase = await inferTipoRelatorio(pdfBuffers);
        }
        else {
            tipoBase = perfilFirestore?.tipoProjetoPadrao ?? "pit";
        }
        const tiposAnalise = Array.from(new Set(tiposProjetoPraComparar.length > 0 ? tiposProjetoPraComparar : [tipoBase]));
        const tiposConfig = tiposAnalise.map((tipo) => {
            const config = (0, normasService_1.getTipoProjetoConfig)(tipo);
            if (!config)
                throw new Error(`Configuração não encontrada para tipo: ${tipo}`);
            return { tipo, config };
        });
        await updateJob(jobRef, solicitacaoRef, "analyzing", 55, "normas");
        const normasMap = new Map();
        if (perfilFirestore?.normasFontes?.length) {
            for (const norma of (0, normasService_1.carregarNormasPDFPorFonteIds)(perfilFirestore.normasFontes)) {
                normasMap.set(norma.fonte.id, norma);
            }
        }
        else {
            for (const tipo of tiposAnalise) {
                for (const norma of (0, normasService_1.carregarNormasPDFParaTipo)(tipo)) {
                    normasMap.set(norma.fonte.id, norma);
                }
            }
        }
        const normasPDFs = Array.from(normasMap.values());
        const dadosForm = {
            titulo: data.titulo ?? "",
            tipoObra: data.tipoObra ?? "",
            localizacao: data.localizacao ?? "",
            descricao: data.descricao ?? "",
            concessionariaId,
            cliente: data.cliente,
            interessado: data.interessado,
            kilometragem: data.kilometragem,
            nroProcessoErp: data.nroProcessoErp,
            rodovia: data.rodovia,
            nomeConcessionaria: data.nomeConcessionaria,
            sentido: data.sentido,
            ocupacao: data.ocupacao,
            municipioEstado: data.municipioEstado,
            uf: data.uf,
            ocupacaoArea: data.ocupacaoArea,
            responsavelTecnico: data.responsavelTecnico,
            extensao: data.extensao,
            numeroArt: data.numeroArt,
            tipoIntervencaoDetalhado: data.tipoIntervencaoDetalhado,
            faseProjeto: data.faseProjeto,
            analistaResponsavel: data.analistaResponsavel,
            memorial: data.memorial,
            dataRecebimento: data.dataRecebimento,
            numeroRevisao: data.numeroRevisao,
        };
        const requisitosPerfil = (0, concessionariaPerfilService_1.getRequisitosFromPerfil)(perfilFirestore);
        const formatarRequisitos = (tipo) => {
            if (requisitosPerfil.length > 0) {
                return requisitosPerfil
                    .map((r) => {
                    const cat = r.categoria ? ` [${r.categoria}]` : "";
                    return `- ${r.id}: ${r.descricao}${cat}`;
                })
                    .join("\n");
            }
            return (0, normasService_1.listarRequisitosFormatados)(tipo, concessionariaId);
        };
        const requisitosFormatados = isProfile
            ? formatarRequisitos(tipoBase)
            : tiposConfig
                .map(({ tipo, config }) => `### ${config.nome} (${tipo})\n${formatarRequisitos(tipo)}`)
                .join("\n\n");
        const tiposProjetoNome = perfilFirestore?.nome ??
            (0, concessionariaProfiles_1.getProfileTipoProjetoNome)(promptProfile) ??
            tiposConfig.map(({ config }) => config.nome).join(", ");
        const systemPrompt = (0, concessionariaProfiles_1.buildProfileSystemPrompt)(promptProfile);
        const promptCustomizadoComPerfil = [
            promptCustomizado,
            perfilFirestore?.perfilCompleto ? (0, concessionariaPerfilService_1.buildCustomAnalysisPromptAddon)(perfilFirestore) : "",
        ]
            .filter(Boolean)
            .join("\n");
        const analysisPrompt = (0, concessionariaProfiles_1.buildProfileAnalysisPrompt)({
            profile: promptProfile,
            dados: dadosForm,
            requisitosFormatados,
            tiposAnalise,
            tiposProjetoNome,
            escopo: escopoAnalise,
            promptCustomizado: promptCustomizadoComPerfil || undefined,
        });
        await updateJob(jobRef, solicitacaoRef, "analyzing", 68, "checklist");
        const parts = [(0, openaiService_1.buildTextInput)(systemPrompt)];
        for (const norma of normasPDFs) {
            parts.push((0, openaiService_1.buildFileInput)(norma.fonte.pdf, norma.buffer));
            parts.push((0, openaiService_1.buildTextInput)(`[NORMA DE REFERÊNCIA: ${norma.fonte.titulo} — ${norma.fonte.orgao}]`));
        }
        if (escopoAnalise.incluirDocumentosProjeto) {
            for (const pdf of pdfBuffers) {
                parts.push((0, openaiService_1.buildFileInput)(pdf.filename, pdf.buffer));
                parts.push((0, openaiService_1.buildTextInput)(buildDocumentoProjetoLabel(pdf.filename, arquivosMeta, pdf.url)));
            }
            if (pdfsOmitidos.length > 0) {
                parts.push((0, openaiService_1.buildTextInput)(`[AVISO: PDFs omitidos por limite: ${pdfsOmitidos.join("; ")}]`));
            }
        }
        parts.push((0, openaiService_1.buildTextInput)(analysisPrompt));
        await updateJob(jobRef, solicitacaoRef, "generating_report", 85, "parecer");
        const result = await (0, openaiService_1.analyze)(parts, {
            maxOutputTokens: isProfile ? 16000 : 12000,
            temperature: 0.1,
            jsonMode: true,
        });
        const parsed = parseAIResponse(result.content);
        const checklistFinal = escopoAnalise.gerarChecklistConformidade ? parsed.checklist : [];
        const parecerFinal = escopoAnalise.gerarParecerTecnico ? parsed.parecerTecnico : "";
        const conferenciaFinal = (0, consistencyAnalyzer_1.complementarConferenciaDeterministica)(parsed.conferenciaInputs, {
            interessado: dadosForm.interessado,
            rodovia: dadosForm.rodovia,
            kilometragem: dadosForm.kilometragem,
            municipioEstado: dadosForm.municipioEstado,
            uf: dadosForm.uf,
            extensao: dadosForm.extensao,
            numeroArt: dadosForm.numeroArt,
            responsavelTecnico: dadosForm.responsavelTecnico,
            tipoIntervencaoDetalhado: dadosForm.tipoIntervencaoDetalhado,
        }, parsed.dadosExtraidos);
        await solicitacaoRef.update({
            status: "em_analise",
            tipoRelatorio: tipoBase,
            tiposProjetoComparados: tiposAnalise,
            escopoAnalise,
            relatorioIA: result.content,
            dadosExtraidos: parsed.dadosExtraidos,
            conferenciaInputs: conferenciaFinal,
            checklistConformidade: escopoAnalise.gerarChecklistConformidade
                ? JSON.stringify(checklistFinal)
                : null,
            parecerTecnico: escopoAnalise.gerarParecerTecnico ? parecerFinal : null,
            analisadoPorIA: true,
            analisadoEm: firestore_1.FieldValue.serverTimestamp(),
            activeAnaliseJobId: null,
            analiseJobStatus: "completed",
            analiseJobProgress: 100,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await jobRef.update({
            state: "completed",
            progress: 100,
            stage: "final",
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido na análise.";
        console.error(`Job ${params.jobId} falhou:`, error);
        await jobRef.update({
            state: "failed",
            progress: 0,
            stage: "prep",
            error: { code: "analysis_failed", message },
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await solicitacaoRef.update({
            status: "pendente",
            activeAnaliseJobId: null,
            analiseJobStatus: "failed",
            analiseJobProgress: 0,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
}
//# sourceMappingURL=analiseJobProcessor.js.map