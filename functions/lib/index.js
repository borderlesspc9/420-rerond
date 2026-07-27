"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatarRelatorioComplementos = exports.analisarSolicitacao = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const openaiService_1 = require("./services/openaiService");
const normasService_1 = require("./services/normasService");
const prompts_1 = require("./config/prompts");
const concessionariaProfiles_1 = require("./config/concessionariaProfiles");
const consistencyAnalyzer_1 = require("./services/consistencyAnalyzer");
const normasService_2 = require("./services/normasService");
const MAX_PDFS_PROJETO = 10;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const app = (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(app);
const storage = (0, storage_1.getStorage)(app);
const openaiApiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
const COLLECTION = process.env.FIRESTORE_SOLICITACOES_COLLECTION?.trim() || "solicitacoes";
const VALID_TIPOS = ["pit", "obra_per", "obra_nao_per"];
function isValidTipo(value) {
    return typeof value === "string" && VALID_TIPOS.includes(value);
}
const DEFAULT_ESCOPO_ANALISE = {
    incluirDadosFormulario: true,
    incluirDocumentosProjeto: true,
    gerarChecklistConformidade: true,
    gerarParecerTecnico: true,
};
function parseEscopoAnalise(value) {
    if (!value || typeof value !== "object") {
        return DEFAULT_ESCOPO_ANALISE;
    }
    const raw = value;
    const escopo = {
        incluirDadosFormulario: typeof raw.incluirDadosFormulario === "boolean"
            ? raw.incluirDadosFormulario
            : DEFAULT_ESCOPO_ANALISE.incluirDadosFormulario,
        incluirDocumentosProjeto: typeof raw.incluirDocumentosProjeto === "boolean"
            ? raw.incluirDocumentosProjeto
            : DEFAULT_ESCOPO_ANALISE.incluirDocumentosProjeto,
        gerarChecklistConformidade: typeof raw.gerarChecklistConformidade === "boolean"
            ? raw.gerarChecklistConformidade
            : DEFAULT_ESCOPO_ANALISE.gerarChecklistConformidade,
        gerarParecerTecnico: typeof raw.gerarParecerTecnico === "boolean"
            ? raw.gerarParecerTecnico
            : DEFAULT_ESCOPO_ANALISE.gerarParecerTecnico,
    };
    if (!escopo.incluirDadosFormulario && !escopo.incluirDocumentosProjeto) {
        throw new https_1.HttpsError("invalid-argument", "Selecione ao menos uma fonte de dados para análise.");
    }
    if (!escopo.gerarChecklistConformidade && !escopo.gerarParecerTecnico) {
        throw new https_1.HttpsError("invalid-argument", "Selecione ao menos uma saída de relatório para geração.");
    }
    return escopo;
}
async function downloadStorageFile(url) {
    const bucket = storage.bucket();
    if (url.includes("firebasestorage.googleapis.com") || url.includes("storage.googleapis.com")) {
        const decodedUrl = decodeURIComponent(url);
        const pathMatch = decodedUrl.match(/\/o\/(.+?)(\?|$)/);
        if (pathMatch) {
            const filePath = pathMatch[1];
            const [buffer] = await bucket.file(filePath).download();
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
        throw new Error(`Falha ao baixar arquivo: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
function extractFilenameFromUrl(url) {
    try {
        const decoded = decodeURIComponent(url);
        const segments = decoded.split("/");
        const last = segments[segments.length - 1]?.split("?")[0];
        return last || "documento.pdf";
    }
    catch {
        return "documento.pdf";
    }
}
function stripMarkdownFence(raw) {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
    }
    else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
}
function extractJsonCandidates(raw) {
    const candidates = new Set();
    const trimmed = raw.trim();
    if (trimmed)
        candidates.add(trimmed);
    candidates.add(stripMarkdownFence(raw));
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) {
        candidates.add(fenced[1].trim());
    }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.add(raw.slice(firstBrace, lastBrace + 1).trim());
    }
    return Array.from(candidates).filter(Boolean);
}
function mapParsedAIResponse(parsed) {
    const dadosExtraidos = parsed.dadosExtraidos && typeof parsed.dadosExtraidos === "object"
        ? parsed.dadosExtraidos
        : null;
    const conferenciaInputs = Array.isArray(parsed.conferenciaInputs)
        ? parsed.conferenciaInputs
        : [];
    return {
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
        parecerTecnico: typeof parsed.parecerTecnico === "string"
            ? parsed.parecerTecnico
            : "Parecer não gerado.",
        dadosExtraidos,
        conferenciaInputs,
    };
}
function parseAIResponse(raw) {
    const candidates = extractJsonCandidates(raw);
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                continue;
            }
            return mapParsedAIResponse(parsed);
        }
        catch {
            // tenta próximo candidato
        }
    }
    const preview = raw.trim().slice(0, 160).replace(/\s+/g, " ");
    console.error("Resposta da IA não é JSON válido. Prévia:", preview);
    throw new https_1.HttpsError("internal", "A IA retornou texto em vez de JSON estruturado. Tente novamente; se persistir, reduza a quantidade de PDFs ou desmarque documentos extras no escopo da análise.");
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
            omitidos.push(`${pdf.filename} (tamanho ${Math.round(pdf.buffer.length / 1024 / 1024)} MB > ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB)`);
            continue;
        }
        incluidos.push(pdf);
    }
    return { incluidos, omitidos };
}
async function inferTipoRelatorio(pdfBuffers) {
    const parts = [];
    for (const pdf of pdfBuffers.slice(0, 2)) {
        parts.push((0, openaiService_1.buildFileInput)(pdf.filename, pdf.buffer));
    }
    parts.push((0, openaiService_1.buildTextInput)((0, prompts_1.buildInferTipoPrompt)()));
    const result = await (0, openaiService_1.analyze)(parts, {
        maxOutputTokens: 50,
        temperature: 0,
    });
    const inferred = result.content.trim().toLowerCase();
    if (isValidTipo(inferred))
        return inferred;
    if (inferred.includes("pit"))
        return "pit";
    if (inferred.includes("nao_per") || inferred.includes("não_per"))
        return "obra_nao_per";
    if (inferred.includes("per"))
        return "obra_per";
    return "pit";
}
exports.analisarSolicitacao = (0, https_1.onCall)({
    region: "southamerica-east1",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [openaiApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Autenticação obrigatória.");
    }
    const solicitacaoId = String(request.data?.solicitacaoId ?? "").trim();
    if (!solicitacaoId) {
        throw new https_1.HttpsError("invalid-argument", "solicitacaoId é obrigatório.");
    }
    const promptCustomizadoRaw = request.data?.promptCustomizado;
    const promptCustomizado = typeof promptCustomizadoRaw === "string" && promptCustomizadoRaw.trim()
        ? promptCustomizadoRaw.trim()
        : undefined;
    const tiposProjetoPraCompararRaw = Array.isArray(request.data?.tiposProjetoPraComparar)
        ? request.data.tiposProjetoPraComparar
        : [];
    const tiposProjetoPraComparar = tiposProjetoPraCompararRaw
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => isValidTipo(item));
    const escopoAnalise = parseEscopoAnalise(request.data?.escopoAnalise);
    const apiKey = openaiApiKey.value()?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "OPENAI_API_KEY não configurada. Defina o secret no Firebase ou OPENAI_API_KEY no emulador.");
    }
    (0, openaiService_1.initOpenAI)(apiKey);
    const docRef = db.collection(COLLECTION).doc(solicitacaoId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        throw new https_1.HttpsError("not-found", "Solicitação não encontrada.");
    }
    const data = snapshot.data();
    const arquivos = Array.isArray(data.arquivos)
        ? data.arquivos
        : [];
    const arquivosMeta = parseArquivosMeta(data.arquivosMeta);
    const concessionariaId = data.concessionariaId
        ? String(data.concessionariaId)
        : null;
    const promptProfile = (0, concessionariaProfiles_1.resolveConcessionariaPromptProfile)(concessionariaId);
    const isProfile = (0, concessionariaProfiles_1.isProfileConcessionaria)(concessionariaId);
    await docRef.update({
        status: "em_analise",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    try {
        const pdfUrls = arquivos.filter((url) => url.toLowerCase().includes(".pdf"));
        console.log(`Baixando ${pdfUrls.length} PDF(s) do projeto...`);
        const pdfBuffersRaw = [];
        for (const url of pdfUrls) {
            try {
                const buffer = await downloadStorageFile(url);
                const filename = extractFilenameFromUrl(url);
                pdfBuffersRaw.push({ filename, buffer, url });
                console.log(`  OK: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
            }
            catch (err) {
                console.error(`  ERRO ao baixar: ${url}`, err);
            }
        }
        const { incluidos: pdfBuffers, omitidos: pdfsOmitidos } = aplicarLimitesPdf(pdfBuffersRaw);
        if (pdfsOmitidos.length > 0) {
            console.warn(`PDFs omitidos por limite: ${pdfsOmitidos.join("; ")}`);
        }
        let tipoBase;
        if (isValidTipo(data.tipoRelatorio)) {
            tipoBase = data.tipoRelatorio;
            console.log(`Tipo de relatório (formulário): ${tipoBase}`);
        }
        else {
            if (pdfBuffers.length > 0) {
                console.log("tipoRelatorio não informado, inferindo via IA...");
                tipoBase = await inferTipoRelatorio(pdfBuffers);
                console.log(`Tipo inferido: ${tipoBase}`);
            }
            else {
                tipoBase = "pit";
                console.log("Sem PDFs para inferência; usando tipo padrão 'pit'.");
            }
        }
        const tiposAnalise = Array.from(new Set(tiposProjetoPraComparar.length > 0
            ? tiposProjetoPraComparar
            : [tipoBase]));
        console.log(`Tipos de análise selecionados: ${tiposAnalise.join(", ")}`);
        const tiposConfig = tiposAnalise.map((tipo) => {
            const config = (0, normasService_1.getTipoProjetoConfig)(tipo);
            if (!config) {
                throw new https_1.HttpsError("internal", `Configuração não encontrada para tipo: ${tipo}`);
            }
            return { tipo, config };
        });
        const normasMap = new Map();
        for (const tipo of tiposAnalise) {
            const normasDoTipo = (0, normasService_1.carregarNormasPDFParaTipo)(tipo);
            for (const norma of normasDoTipo) {
                normasMap.set(norma.fonte.id, norma);
            }
        }
        const normasPDFs = Array.from(normasMap.values());
        console.log(`Normas carregadas: ${normasPDFs.length}`);
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
        console.log(`Perfil de análise: ${promptProfile} | concessionariaId=${concessionariaId ?? "n/a"}`);
        const requisitosFormatados = isProfile
            ? (0, normasService_1.listarRequisitosFormatados)(tipoBase, concessionariaId)
            : tiposConfig
                .map(({ tipo, config }) => `### ${config.nome} (${tipo})\n${(0, normasService_1.listarRequisitosFormatados)(tipo, concessionariaId)}`)
                .join("\n\n");
        const tiposProjetoNome = (0, concessionariaProfiles_1.getProfileTipoProjetoNome)(promptProfile) ??
            tiposConfig.map(({ config }) => config.nome).join(", ");
        const systemPrompt = (0, concessionariaProfiles_1.buildProfileSystemPrompt)(promptProfile);
        const analysisPrompt = (0, concessionariaProfiles_1.buildProfileAnalysisPrompt)({
            profile: promptProfile,
            dados: dadosForm,
            requisitosFormatados,
            tiposAnalise,
            tiposProjetoNome,
            escopo: escopoAnalise,
            promptCustomizado,
        });
        const parts = [];
        parts.push((0, openaiService_1.buildTextInput)(systemPrompt));
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
                parts.push((0, openaiService_1.buildTextInput)(`[AVISO: Os seguintes PDFs do projeto foram omitidos por limite de quantidade ou tamanho: ${pdfsOmitidos.join("; ")}]`));
            }
        }
        parts.push((0, openaiService_1.buildTextInput)(analysisPrompt));
        console.log(`Enviando para OpenAI: ${normasPDFs.length} norma(s) + ${escopoAnalise.incluirDocumentosProjeto ? pdfBuffers.length : 0} PDF(s) do projeto`);
        const result = await (0, openaiService_1.analyze)(parts, {
            maxOutputTokens: isProfile ? 16000 : 12000,
            temperature: 0.1,
            jsonMode: true,
        });
        console.log(`Resposta recebida. Modelo: ${result.model}, Tokens: ${result.tokensUsed ?? "N/A"}`);
        const parsed = parseAIResponse(result.content);
        const checklistFinal = escopoAnalise.gerarChecklistConformidade
            ? parsed.checklist
            : [];
        const parecerFinal = escopoAnalise.gerarParecerTecnico
            ? parsed.parecerTecnico
            : "";
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
        await docRef.update({
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
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const updatedSnap = await docRef.get();
        const updatedData = updatedSnap.data();
        return {
            id: solicitacaoId,
            ...updatedData,
            arquivos: Array.isArray(updatedData.arquivos)
                ? updatedData.arquivos
                : [],
            createdAt: updatedData.createdAt?.toDate?.()?.toISOString() ?? null,
            updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() ?? null,
            analisadoEm: updatedData.analisadoEm?.toDate?.()?.toISOString() ?? null,
        };
    }
    catch (error) {
        console.error("Erro na análise:", error);
        await docRef.update({
            status: "pendente",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        const message = error instanceof Error ? error.message : "Erro desconhecido na análise.";
        throw new https_1.HttpsError("internal", message);
    }
});
function parseComplementos(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => {
        if (!entry || typeof entry !== "object")
            return null;
        const raw = entry;
        const item = String(raw.item ?? "").trim().toUpperCase();
        const texto = String(raw.texto ?? "").trim();
        if (!item || !texto)
            return null;
        return { item, texto };
    })
        .filter((entry) => entry !== null);
}
function mapComplementosComDescricao(complementos, tipo) {
    const requisitos = (0, normasService_2.getRequisitosParaTipo)(tipo);
    const descricaoPorId = new Map(requisitos.map((req) => [req.id, req.descricao]));
    return complementos.map((c) => ({
        item: c.item,
        texto: c.texto,
        descricao: descricaoPorId.get(c.item) ?? c.item.replace(/_/g, " "),
    }));
}
exports.formatarRelatorioComplementos = (0, https_1.onCall)({
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [openaiApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Autenticação obrigatória.");
    }
    const solicitacaoId = String(request.data?.solicitacaoId ?? "").trim();
    if (!solicitacaoId) {
        throw new https_1.HttpsError("invalid-argument", "solicitacaoId é obrigatório.");
    }
    const complementos = parseComplementos(request.data?.complementosChecklist);
    if (complementos.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Informe ao menos um complemento com texto.");
    }
    const apiKey = openaiApiKey.value()?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "OPENAI_API_KEY não configurada.");
    }
    (0, openaiService_1.initOpenAI)(apiKey);
    const docRef = db.collection(COLLECTION).doc(solicitacaoId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        throw new https_1.HttpsError("not-found", "Solicitação não encontrada.");
    }
    const data = snapshot.data();
    const checklistAnterior = typeof data.checklistConformidade === "string"
        ? data.checklistConformidade
        : "[]";
    const parecerAnterior = typeof data.parecerTecnico === "string" ? data.parecerTecnico : "";
    if (!checklistAnterior || checklistAnterior === "[]") {
        throw new https_1.HttpsError("failed-precondition", "A solicitação precisa de uma análise prévia antes de complementar.");
    }
    let tipoBase;
    if (isValidTipo(data.tipoRelatorio)) {
        tipoBase = data.tipoRelatorio;
    }
    else {
        tipoBase = "pit";
    }
    const tipoConfig = (0, normasService_1.getTipoProjetoConfig)(tipoBase);
    const requisitosFormatados = (0, normasService_1.listarRequisitosFormatados)(tipoBase);
    const tiposProjetoNome = tipoConfig?.nome ?? tipoBase;
    const dadosForm = {
        titulo: data.titulo ?? "",
        tipoObra: data.tipoObra ?? "",
        localizacao: data.localizacao ?? "",
        descricao: data.descricao ?? "",
        concessionariaId: data.concessionariaId ? String(data.concessionariaId) : null,
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
    const complementosEnriquecidos = mapComplementosComDescricao(complementos, tipoBase);
    const systemPrompt = (0, prompts_1.buildComplementacaoSystemPrompt)();
    const complementacaoPrompt = (0, prompts_1.buildComplementacaoPrompt)(dadosForm, tiposProjetoNome, requisitosFormatados, checklistAnterior, parecerAnterior, complementosEnriquecidos);
    const parts = [
        (0, openaiService_1.buildTextInput)(systemPrompt),
        (0, openaiService_1.buildTextInput)(complementacaoPrompt),
    ];
    console.log(`Formatando relatório com ${complementos.length} complemento(s) para ${solicitacaoId}`);
    const result = await (0, openaiService_1.analyze)(parts, {
        maxOutputTokens: 12000,
        temperature: 0.1,
        jsonMode: true,
    });
    const { checklist, parecerTecnico } = parseAIResponse(result.content);
    const complementosSerializados = JSON.stringify(complementos);
    await docRef.update({
        status: "em_analise",
        checklistConformidade: JSON.stringify(checklist),
        parecerTecnico,
        complementosChecklist: complementosSerializados,
        relatorioIA: result.content,
        analisadoPorIA: true,
        analisadoEm: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const updatedSnap = await docRef.get();
    const updatedData = updatedSnap.data();
    return {
        id: solicitacaoId,
        ...updatedData,
        arquivos: Array.isArray(updatedData.arquivos) ? updatedData.arquivos : [],
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() ?? null,
        analisadoEm: updatedData.analisadoEm?.toDate?.()?.toISOString() ?? null,
    };
});
//# sourceMappingURL=index.js.map