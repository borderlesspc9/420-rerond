import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

import {
  initOpenAI,
  analyze,
  buildFileInput,
  buildTextInput,
  type InputPart,
} from "./services/openaiService";
import {
  carregarNormasPDFParaTipo,
  getTipoProjetoConfig,
  listarRequisitosFormatados,
  type TipoRelatorio,
} from "./services/normasService";
import {
  buildInferTipoPrompt,
  buildComplementacaoSystemPrompt,
  buildComplementacaoPrompt,
  type ComplementoInput,
  type DadosFormulario,
  type EscopoAnalisePrompt,
} from "./config/prompts";
import {
  buildProfileAnalysisPrompt,
  buildProfileSystemPrompt,
  getProfileTipoProjetoNome,
  isProfileConcessionaria,
  resolveConcessionariaPromptProfile,
} from "./config/concessionariaProfiles";
import {
  complementarConferenciaDeterministica,
  type ConferenciaInput,
  type DadosExtraidosAnalise,
} from "./services/consistencyAnalyzer";
import { getRequisitosParaTipo } from "./services/normasService";
import {
  buildCustomAnalysisPromptAddon,
  getConcessionariaPerfilFromFirestore,
  getRequisitosFromPerfil,
} from "./services/concessionariaPerfilService";
import { runAnaliseJob } from "./services/analiseJobProcessor";

const MAX_PDFS_PROJETO = 10;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

const app = initializeApp();
const db = getFirestore(app);
const storage = getStorage(app);

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const COLLECTION =
  process.env.FIRESTORE_SOLICITACOES_COLLECTION?.trim() || "solicitacoes";

const VALID_TIPOS: TipoRelatorio[] = ["pit", "obra_per", "obra_nao_per"];

function isValidTipo(value: unknown): value is TipoRelatorio {
  return typeof value === "string" && VALID_TIPOS.includes(value as TipoRelatorio);
}

const DEFAULT_ESCOPO_ANALISE: EscopoAnalisePrompt = {
  incluirDadosFormulario: true,
  incluirDocumentosProjeto: true,
  gerarChecklistConformidade: true,
  gerarParecerTecnico: true,
};

function parseEscopoAnalise(value: unknown): EscopoAnalisePrompt {
  if (!value || typeof value !== "object") {
    return DEFAULT_ESCOPO_ANALISE;
  }

  const raw = value as Record<string, unknown>;
  const escopo: EscopoAnalisePrompt = {
    incluirDadosFormulario:
      typeof raw.incluirDadosFormulario === "boolean"
        ? raw.incluirDadosFormulario
        : DEFAULT_ESCOPO_ANALISE.incluirDadosFormulario,
    incluirDocumentosProjeto:
      typeof raw.incluirDocumentosProjeto === "boolean"
        ? raw.incluirDocumentosProjeto
        : DEFAULT_ESCOPO_ANALISE.incluirDocumentosProjeto,
    gerarChecklistConformidade:
      typeof raw.gerarChecklistConformidade === "boolean"
        ? raw.gerarChecklistConformidade
        : DEFAULT_ESCOPO_ANALISE.gerarChecklistConformidade,
    gerarParecerTecnico:
      typeof raw.gerarParecerTecnico === "boolean"
        ? raw.gerarParecerTecnico
        : DEFAULT_ESCOPO_ANALISE.gerarParecerTecnico,
  };

  if (!escopo.incluirDadosFormulario && !escopo.incluirDocumentosProjeto) {
    throw new HttpsError(
      "invalid-argument",
      "Selecione ao menos uma fonte de dados para análise.",
    );
  }

  if (!escopo.gerarChecklistConformidade && !escopo.gerarParecerTecnico) {
    throw new HttpsError(
      "invalid-argument",
      "Selecione ao menos uma saída de relatório para geração.",
    );
  }

  return escopo;
}

async function downloadStorageFile(url: string): Promise<Buffer> {
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

function extractFilenameFromUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const segments = decoded.split("/");
    const last = segments[segments.length - 1]?.split("?")[0];
    return last || "documento.pdf";
  } catch {
    return "documento.pdf";
  }
}

function stripMarkdownFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function extractJsonCandidates(raw: string): string[] {
  const candidates = new Set<string>();
  const trimmed = raw.trim();
  if (trimmed) candidates.add(trimmed);
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

function mapParsedAIResponse(parsed: Record<string, unknown>): {
  checklist: unknown[];
  parecerTecnico: string;
  dadosExtraidos: DadosExtraidosAnalise | null;
  conferenciaInputs: ConferenciaInput[];
} {
  const dadosExtraidos =
    parsed.dadosExtraidos && typeof parsed.dadosExtraidos === "object"
      ? (parsed.dadosExtraidos as DadosExtraidosAnalise)
      : null;

  const conferenciaInputs = Array.isArray(parsed.conferenciaInputs)
    ? (parsed.conferenciaInputs as ConferenciaInput[])
    : [];

  return {
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    parecerTecnico:
      typeof parsed.parecerTecnico === "string"
        ? parsed.parecerTecnico
        : "Parecer não gerado.",
    dadosExtraidos,
    conferenciaInputs,
  };
}

function parseAIResponse(raw: string): {
  checklist: unknown[];
  parecerTecnico: string;
  dadosExtraidos: DadosExtraidosAnalise | null;
  conferenciaInputs: ConferenciaInput[];
} {
  const candidates = extractJsonCandidates(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        continue;
      }
      return mapParsedAIResponse(parsed);
    } catch {
      // tenta próximo candidato
    }
  }

  const preview = raw.trim().slice(0, 160).replace(/\s+/g, " ");
  console.error("Resposta da IA não é JSON válido. Prévia:", preview);

  throw new HttpsError(
    "internal",
    "A IA retornou texto em vez de JSON estruturado. Tente novamente; se persistir, reduza a quantidade de PDFs ou desmarque documentos extras no escopo da análise.",
  );
}

interface ArquivoMetaDoc {
  url: string;
  nome: string;
  tipoDocumento?: string;
}

function parseArquivosMeta(value: unknown): ArquivoMetaDoc[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        url: String(raw.url ?? ""),
        nome: String(raw.nome ?? ""),
        tipoDocumento: raw.tipoDocumento ? String(raw.tipoDocumento) : "desconhecido",
      };
    })
    .filter((item) => item.url);
}

function buildDocumentoProjetoLabel(
  filename: string,
  arquivosMeta: ArquivoMetaDoc[],
  url?: string,
): string {
  const meta = arquivosMeta.find((m) => m.url === url || m.nome === filename);
  const tipo = meta?.tipoDocumento ?? "desconhecido";
  const nome = meta?.nome ?? filename;
  return `[DOCUMENTO DO PROJETO: tipoDocumento=${tipo}; arquivo=${nome}]`;
}

function aplicarLimitesPdf(
  pdfBuffers: Array<{ filename: string; buffer: Buffer; url?: string }>,
): {
  incluidos: Array<{ filename: string; buffer: Buffer; url?: string }>;
  omitidos: string[];
} {
  const incluidos: Array<{ filename: string; buffer: Buffer; url?: string }> = [];
  const omitidos: string[] = [];

  for (const pdf of pdfBuffers) {
    if (incluidos.length >= MAX_PDFS_PROJETO) {
      omitidos.push(`${pdf.filename} (limite de ${MAX_PDFS_PROJETO} PDFs)`);
      continue;
    }
    if (pdf.buffer.length > MAX_PDF_SIZE_BYTES) {
      omitidos.push(
        `${pdf.filename} (tamanho ${Math.round(pdf.buffer.length / 1024 / 1024)} MB > ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB)`,
      );
      continue;
    }
    incluidos.push(pdf);
  }

  return { incluidos, omitidos };
}

async function inferTipoRelatorio(
  pdfBuffers: Array<{ filename: string; buffer: Buffer }>,
): Promise<TipoRelatorio> {
  const parts: InputPart[] = [];

  for (const pdf of pdfBuffers.slice(0, 2)) {
    parts.push(buildFileInput(pdf.filename, pdf.buffer));
  }
  parts.push(buildTextInput(buildInferTipoPrompt()));

  const result = await analyze(parts, {
    maxOutputTokens: 50,
    temperature: 0,
  });

  const inferred = result.content.trim().toLowerCase();
  if (isValidTipo(inferred)) return inferred;

  if (inferred.includes("pit")) return "pit";
  if (inferred.includes("nao_per") || inferred.includes("não_per")) return "obra_nao_per";
  if (inferred.includes("per")) return "obra_per";

  return "pit";
}

export const analisarSolicitacao = onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticação obrigatória.");
    }

    const solicitacaoId = String(request.data?.solicitacaoId ?? "").trim();
    if (!solicitacaoId) {
      throw new HttpsError("invalid-argument", "solicitacaoId é obrigatório.");
    }

    const promptCustomizadoRaw = request.data?.promptCustomizado;
    const promptCustomizado =
      typeof promptCustomizadoRaw === "string" && promptCustomizadoRaw.trim()
        ? promptCustomizadoRaw.trim()
        : undefined;

    const tiposProjetoPraCompararRaw = Array.isArray(request.data?.tiposProjetoPraComparar)
      ? request.data.tiposProjetoPraComparar
      : [];
    const tiposProjetoPraComparar = tiposProjetoPraCompararRaw
      .map((item: unknown) => String(item).trim().toLowerCase())
      .filter((item: string): item is TipoRelatorio => isValidTipo(item));

    const escopoAnalise = parseEscopoAnalise(request.data?.escopoAnalise);

    const docRef = db.collection(COLLECTION).doc(solicitacaoId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada.");
    }

    const data = snapshot.data()!;
    const activeJobId = data.activeAnaliseJobId ? String(data.activeAnaliseJobId) : null;
    const activeJobStatus = data.analiseJobStatus ? String(data.analiseJobStatus) : null;
    const activeStates = new Set([
      "uploaded",
      "queued",
      "extracting",
      "analyzing",
      "generating_report",
    ]);

    if (activeJobId && activeJobStatus && activeStates.has(activeJobStatus)) {
      return { jobId: activeJobId, solicitacaoId, reused: true };
    }

    const jobRef = docRef.collection("analiseJobs").doc();
    const jobId = jobRef.id;

    await jobRef.set({
      id: jobId,
      solicitacaoId,
      state: "queued",
      progress: 12,
      stage: "prep",
      promptCustomizado: promptCustomizado ?? null,
      tiposProjetoPraComparar,
      escopoAnalise,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await docRef.update({
      activeAnaliseJobId: jobId,
      analiseJobStatus: "queued",
      analiseJobProgress: 12,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { jobId, solicitacaoId, reused: false };
  },
);

export const processAnaliseJob = onDocumentCreated(
  {
    document: `${COLLECTION}/{solicitacaoId}/analiseJobs/{jobId}`,
    region: "southamerica-east1",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [openaiApiKey],
  },
  async (event) => {
    const apiKey =
      openaiApiKey.value()?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
      console.error("OPENAI_API_KEY não configurada para processamento do job.");
      return;
    }

    const solicitacaoId = String(event.params.solicitacaoId ?? "");
    const jobId = String(event.params.jobId ?? "");
    if (!solicitacaoId || !jobId) return;

    await runAnaliseJob({
      solicitacaoId,
      jobId,
      apiKey,
      collection: COLLECTION,
    });
  },
);

interface ComplementoPayload {
  item: string;
  texto: string;
}

function parseComplementos(value: unknown): ComplementoPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const item = String(raw.item ?? "").trim().toUpperCase();
      const texto = String(raw.texto ?? "").trim();
      if (!item || !texto) return null;
      return { item, texto };
    })
    .filter((entry): entry is ComplementoPayload => entry !== null);
}

function mapComplementosComDescricao(
  complementos: ComplementoPayload[],
  tipo: TipoRelatorio,
): ComplementoInput[] {
  const requisitos = getRequisitosParaTipo(tipo);
  const descricaoPorId = new Map(
    requisitos.map((req) => [req.id, req.descricao]),
  );

  return complementos.map((c) => ({
    item: c.item,
    texto: c.texto,
    descricao: descricaoPorId.get(c.item) ?? c.item.replace(/_/g, " "),
  }));
}

export const formatarRelatorioComplementos = onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [openaiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticação obrigatória.");
    }

    const solicitacaoId = String(request.data?.solicitacaoId ?? "").trim();
    if (!solicitacaoId) {
      throw new HttpsError("invalid-argument", "solicitacaoId é obrigatório.");
    }

    const complementos = parseComplementos(request.data?.complementosChecklist);
    if (complementos.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Informe ao menos um complemento com texto.",
      );
    }

    const apiKey =
      openaiApiKey.value()?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY não configurada.",
      );
    }
    initOpenAI(apiKey);

    const docRef = db.collection(COLLECTION).doc(solicitacaoId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada.");
    }

    const data = snapshot.data()!;
    const checklistAnterior =
      typeof data.checklistConformidade === "string"
        ? data.checklistConformidade
        : "[]";
    const parecerAnterior =
      typeof data.parecerTecnico === "string" ? data.parecerTecnico : "";

    if (!checklistAnterior || checklistAnterior === "[]") {
      throw new HttpsError(
        "failed-precondition",
        "A solicitação precisa de uma análise prévia antes de complementar.",
      );
    }

    let tipoBase: TipoRelatorio;
    if (isValidTipo(data.tipoRelatorio)) {
      tipoBase = data.tipoRelatorio;
    } else {
      tipoBase = "pit";
    }

    const tipoConfig = getTipoProjetoConfig(tipoBase);
    const requisitosFormatados = listarRequisitosFormatados(tipoBase);
    const tiposProjetoNome = tipoConfig?.nome ?? tipoBase;

    const dadosForm: DadosFormulario = {
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

    const complementosEnriquecidos = mapComplementosComDescricao(
      complementos,
      tipoBase,
    );

    const systemPrompt = buildComplementacaoSystemPrompt();
    const complementacaoPrompt = buildComplementacaoPrompt(
      dadosForm,
      tiposProjetoNome,
      requisitosFormatados,
      checklistAnterior,
      parecerAnterior,
      complementosEnriquecidos,
    );

    const parts: InputPart[] = [
      buildTextInput(systemPrompt),
      buildTextInput(complementacaoPrompt),
    ];

    console.log(
      `Formatando relatório com ${complementos.length} complemento(s) para ${solicitacaoId}`,
    );

    const result = await analyze(parts, {
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
      analisadoEm: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedSnap = await docRef.get();
    const updatedData = updatedSnap.data()!;

    return {
      id: solicitacaoId,
      ...updatedData,
      arquivos: Array.isArray(updatedData.arquivos) ? updatedData.arquivos : [],
      createdAt: updatedData.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() ?? null,
      analisadoEm: updatedData.analisadoEm?.toDate?.()?.toISOString() ?? null,
    };
  },
);
