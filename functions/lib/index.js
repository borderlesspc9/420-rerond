"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analisarSolicitacao = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const openaiService_1 = require("./services/openaiService");
const normasService_1 = require("./services/normasService");
const prompts_1 = require("./config/prompts");
const app = (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(app);
const storage = (0, storage_1.getStorage)(app);
const openaiApiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
const COLLECTION = process.env.FIRESTORE_SOLICITACOES_COLLECTION?.trim() || "solicitacoes";
const VALID_TIPOS = ["pit", "obra_per", "obra_nao_per"];
function isValidTipo(value) {
    return typeof value === "string" && VALID_TIPOS.includes(value);
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
function parseAIResponse(raw) {
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
    cleaned = cleaned.trim();
    const parsed = JSON.parse(cleaned);
    return {
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
        parecerTecnico: typeof parsed.parecerTecnico === "string"
            ? parsed.parecerTecnico
            : "Parecer não gerado.",
    };
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
    await docRef.update({
        status: "em_analise",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    try {
        const pdfUrls = arquivos.filter((url) => url.toLowerCase().includes(".pdf"));
        console.log(`Baixando ${pdfUrls.length} PDF(s) do projeto...`);
        const pdfBuffers = [];
        for (const url of pdfUrls) {
            try {
                const buffer = await downloadStorageFile(url);
                const filename = extractFilenameFromUrl(url);
                pdfBuffers.push({ filename, buffer });
                console.log(`  OK: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
            }
            catch (err) {
                console.error(`  ERRO ao baixar: ${url}`, err);
            }
        }
        let tipoRelatorio;
        if (isValidTipo(data.tipoRelatorio)) {
            tipoRelatorio = data.tipoRelatorio;
            console.log(`Tipo de relatório (formulário): ${tipoRelatorio}`);
        }
        else {
            console.log("tipoRelatorio não informado, inferindo via IA...");
            tipoRelatorio = await inferTipoRelatorio(pdfBuffers);
            console.log(`Tipo inferido: ${tipoRelatorio}`);
        }
        const tipoConfig = (0, normasService_1.getTipoProjetoConfig)(tipoRelatorio);
        if (!tipoConfig) {
            throw new https_1.HttpsError("internal", `Configuração não encontrada para tipo: ${tipoRelatorio}`);
        }
        console.log(`Carregando norma(s) para tipo: ${tipoConfig.nome}`);
        const normasPDFs = (0, normasService_1.carregarNormasPDFParaTipo)(tipoRelatorio);
        const dadosForm = {
            titulo: data.titulo ?? "",
            tipoObra: data.tipoObra ?? "",
            localizacao: data.localizacao ?? "",
            descricao: data.descricao ?? "",
            cliente: data.cliente,
            kilometragem: data.kilometragem,
            nroProcessoErp: data.nroProcessoErp,
            rodovia: data.rodovia,
            nomeConcessionaria: data.nomeConcessionaria,
            sentido: data.sentido,
            ocupacao: data.ocupacao,
            municipioEstado: data.municipioEstado,
            ocupacaoArea: data.ocupacaoArea,
            responsavelTecnico: data.responsavelTecnico,
            faseProjeto: data.faseProjeto,
            analistaResponsavel: data.analistaResponsavel,
            memorial: data.memorial,
            dataRecebimento: data.dataRecebimento,
            numeroRevisao: data.numeroRevisao,
        };
        const requisitosFormatados = (0, normasService_1.listarRequisitosFormatados)(tipoRelatorio);
        const systemPrompt = (0, prompts_1.buildSystemPrompt)();
        const analysisPrompt = (0, prompts_1.buildAnalysisPrompt)(dadosForm, tipoRelatorio, requisitosFormatados, tipoConfig.nome);
        const parts = [];
        parts.push((0, openaiService_1.buildTextInput)(systemPrompt));
        for (const norma of normasPDFs) {
            parts.push((0, openaiService_1.buildFileInput)(norma.fonte.pdf, norma.buffer));
            parts.push((0, openaiService_1.buildTextInput)(`[NORMA DE REFERÊNCIA: ${norma.fonte.titulo} — ${norma.fonte.orgao}]`));
        }
        for (const pdf of pdfBuffers) {
            parts.push((0, openaiService_1.buildFileInput)(pdf.filename, pdf.buffer));
            parts.push((0, openaiService_1.buildTextInput)(`[DOCUMENTO DO PROJETO: ${pdf.filename}]`));
        }
        parts.push((0, openaiService_1.buildTextInput)(analysisPrompt));
        console.log(`Enviando para OpenAI: ${normasPDFs.length} norma(s) + ${pdfBuffers.length} PDF(s) do projeto`);
        const result = await (0, openaiService_1.analyze)(parts, {
            maxOutputTokens: 8000,
            temperature: 0.1,
        });
        console.log(`Resposta recebida. Modelo: ${result.model}, Tokens: ${result.tokensUsed ?? "N/A"}`);
        const { checklist, parecerTecnico } = parseAIResponse(result.content);
        await docRef.update({
            status: "em_analise",
            tipoRelatorio,
            relatorioIA: result.content,
            checklistConformidade: JSON.stringify(checklist),
            parecerTecnico,
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
//# sourceMappingURL=index.js.map