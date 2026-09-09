import { FieldValue, type DocumentReference, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  initOpenAI,
  analyze,
  buildFileInput,
  buildTextInput,
  type InputPart,
} from "./openaiService";
import {
  carregarNormasPDFParaTipo,
  carregarNormasPDFPorFonteIds,
  getTipoProjetoConfig,
  listarRequisitosFormatados,
  type TipoRelatorio,
} from "./normasService";
import {
  buildInferTipoPrompt,
  type DadosFormulario,
  type EscopoAnalisePrompt,
} from "../config/prompts";
import {
  buildProfileAnalysisPrompt,
  buildProfileSystemPrompt,
  getProfileTipoProjetoNome,
  isProfileConcessionaria,
  resolveConcessionariaPromptProfile,
} from "../config/concessionariaProfiles";
import { buildEco101ExemploAnaliseBlock } from "../config/exemplosAnalise";
import {
  complementarConferenciaDeterministica,
  parseEvidencia,
  type ConferenciaInput,
  type DadosExtraidosAnalise,
} from "./consistencyAnalyzer";
import {
  buildCustomAnalysisPromptAddon,
  getConcessionariaPerfilFromFirestore,
  getRequisitosFromPerfil,
} from "./concessionariaPerfilService";
import {
  buildTipoAnalisePromptAddon,
  formatarRequisitosTipoAnalise,
  getTipoAnaliseFromFirestore,
} from "./tipoAnaliseService";
import {
  buildFeedbackAprendizadoPromptBlock,
  listFeedbacksAprovadosParaAnalise,
} from "./feedbackAprendizadoService";
import {
  buildGoldenCasesPromptBlock,
  listGoldenCasesAprovadosParaAnalise,
} from "./goldenCaseService";

export type AnaliseJobState =
  | "uploaded"
  | "queued"
  | "extracting"
  | "analyzing"
  | "generating_report"
  | "completed"
  | "failed";

const MAX_PDFS_PROJETO = 10;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const VALID_TIPOS: TipoRelatorio[] = ["pit", "obra_per", "obra_nao_per"];

const storage = getStorage();

function isValidTipo(value: unknown): value is TipoRelatorio {
  return typeof value === "string" && VALID_TIPOS.includes(value as TipoRelatorio);
}

interface ArquivoMetaDoc {
  url: string;
  nome: string;
  tipoDocumento?: string;
}

async function updateJob(
  jobRef: DocumentReference,
  solicitacaoRef: DocumentReference,
  state: AnaliseJobState,
  progress: number,
  stage: string,
  extra: Record<string, unknown> = {},
) {
  const payload = {
    state,
    progress,
    stage,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
  await jobRef.update(payload);
  await solicitacaoRef.update({
    analiseJobStatus: state,
    analiseJobProgress: progress,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function downloadStorageFile(url: string): Promise<Buffer> {
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

function extractFilenameFromUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const segments = decoded.split("/");
    return segments[segments.length - 1]?.split("?")[0] || "documento.pdf";
  } catch {
    return "documento.pdf";
  }
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
  const pecasGraficas = new Set(["planta_baixa", "perfil_ocupacao", "projeto_sinalizacao"]);
  if (pecasGraficas.has(tipo)) {
    return `[PEÇA GRÁFICA — analisar desenho, cotas, FXD, km, sentido; não só o nome do arquivo | tipoDocumento=${tipo}; arquivo=${nome}]`;
  }
  return `[DOCUMENTO DO PROJETO: tipoDocumento=${tipo}; arquivo=${nome}]`;
}

function previousRevisaoLabel(current?: string | null): string | null {
  const match = String(current || "").match(/R(\d+)/i);
  if (!match) return null;
  const idx = Number(match[1]);
  if (!Number.isFinite(idx) || idx <= 0) return null;
  return `R${String(idx - 1).padStart(2, "0")}`;
}

function formatPendenciasFromChecklist(checklistRaw: unknown): string {
  if (typeof checklistRaw !== "string" || !checklistRaw.trim()) {
    return "(sem checklist na revisão anterior)";
  }
  try {
    const parsed = JSON.parse(checklistRaw) as unknown;
    if (!Array.isArray(parsed)) return checklistRaw.slice(0, 8000);
    const pendencias = parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const status = String((item as { status?: unknown }).status || "").toUpperCase();
      return status === "NAO_CONFORME" || status === "INFORMACAO_AUSENTE";
    });
    if (pendencias.length === 0) {
      return "(nenhuma pendência NAO_CONFORME / INFORMACAO_AUSENTE na revisão anterior)";
    }
    return pendencias
      .map((item) => {
        const row = item as Record<string, unknown>;
        return [
          `- Item: ${String(row.item ?? "")}`,
          `  Status: ${String(row.status ?? "")}`,
          `  Situação: ${String(row.situacaoEncontrada ?? "")}`,
          `  Orientação: ${String(row.orientacao ?? "")}`,
        ].join("\n");
      })
      .join("\n");
  } catch {
    return String(checklistRaw).slice(0, 8000);
  }
}

function buildBlocoContextoAnaliseAnterior(params: {
  tituloBloco: string;
  origemLabel: string;
  titulo?: string | null;
  versao?: number | null;
  checklistConformidade?: string | null;
  parecerTecnico?: string | null;
  complementosChecklist?: string | null;
  observacoesAnalista?: string | null;
}): string {
  const parecer = (params.parecerTecnico || "").trim().slice(0, 12000);
  const pendencias = formatPendenciasFromChecklist(params.checklistConformidade || undefined);
  const checklistResumo = (params.checklistConformidade || "").trim().slice(0, 10000);
  const complementos = (params.complementosChecklist || "").trim().slice(0, 4000);
  const observacoes = (params.observacoesAnalista || "").trim().slice(0, 3000);
  const versaoLabel =
    typeof params.versao === "number" && params.versao > 0 ? `v${params.versao}` : "anterior";

  return [
    params.tituloBloco,
    `Origem: ${params.origemLabel}`,
    `Versão de referência: ${versaoLabel}`,
    `Título: ${params.titulo || "não informado"}`,
    "",
    "PENDÊNCIAS / NÃO CONFORMIDADES DA ANÁLISE ANTERIOR:",
    pendencias,
    "",
    "PARECER TÉCNICO ANTERIOR (Markdown, pode estar truncado):",
    parecer || "(sem parecer anterior)",
    "",
    "CHECKLIST COMPLETO ANTERIOR (JSON, pode estar truncado):",
    checklistResumo || "(sem checklist anterior)",
    complementos
      ? `\nCOMPLEMENTOS / OBSERVAÇÕES HUMANAS DO ANALISTA (não descartar sem motivo):\n${complementos}`
      : "",
    observacoes ? `\nOBSERVAÇÕES REGISTRADAS NA SOLICITAÇÃO:\n${observacoes}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Memória da mesma solicitação (reanálise vN → vN+1). */
function loadContextoVersaoAnteriorMesmaSolicitacao(
  solicitacaoId: string,
  data: Record<string, unknown>,
): string | null {
  const temAnalise =
    (typeof data.parecerTecnico === "string" && data.parecerTecnico.trim()) ||
    (typeof data.checklistConformidade === "string" && data.checklistConformidade.trim()) ||
    (typeof data.relatorioIA === "string" && data.relatorioIA.trim()) ||
    (typeof data.analiseVersaoAtual === "number" && data.analiseVersaoAtual > 0);

  if (!temAnalise) return null;

  const versaoAtual =
    typeof data.analiseVersaoAtual === "number" && data.analiseVersaoAtual > 0
      ? data.analiseVersaoAtual
      : 1;

  return buildBlocoContextoAnaliseAnterior({
    tituloBloco: "CONTEXTO DA VERSÃO ANTERIOR DESTA MESMA SOLICITAÇÃO",
    origemLabel: `solicitação ${solicitacaoId} (reanálise na mesma ficha)`,
    titulo: data.titulo ? String(data.titulo) : null,
    versao: versaoAtual,
    checklistConformidade:
      typeof data.checklistConformidade === "string" ? data.checklistConformidade : null,
    parecerTecnico: typeof data.parecerTecnico === "string" ? data.parecerTecnico : null,
    complementosChecklist:
      typeof data.complementosChecklist === "string" ? data.complementosChecklist : null,
    observacoesAnalista:
      typeof data.descricao === "string"
        ? data.descricao
        : typeof data.observacoes === "string"
          ? data.observacoes
          : null,
  });
}

async function loadContextoRevisaoAnterior(
  currentSolicitacaoId: string,
  processoId?: string | null,
  numeroRevisao?: string | null,
): Promise<string | null> {
  if (!processoId) return null;
  const prevLabel = previousRevisaoLabel(numeroRevisao);
  if (!prevLabel) return null;

  const db = getFirestore();
  const snap = await db
    .collection("solicitacoes")
    .where("processoId", "==", processoId)
    .get();

  type Candidate = {
    id: string;
    createdAtMs: number;
    numeroRevisao?: string;
    checklistConformidade?: string;
    parecerTecnico?: string;
    complementosChecklist?: string;
    titulo?: string;
    analiseVersaoAtual?: number;
  };

  const candidates: Candidate[] = snap.docs
    .filter((doc) => doc.id !== currentSolicitacaoId)
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
      return {
        id: doc.id,
        createdAtMs: createdAt?.toMillis?.() ?? 0,
        numeroRevisao: data.numeroRevisao ? String(data.numeroRevisao) : undefined,
        checklistConformidade:
          typeof data.checklistConformidade === "string"
            ? data.checklistConformidade
            : undefined,
        parecerTecnico:
          typeof data.parecerTecnico === "string" ? data.parecerTecnico : undefined,
        complementosChecklist:
          typeof data.complementosChecklist === "string"
            ? data.complementosChecklist
            : undefined,
        titulo: data.titulo ? String(data.titulo) : undefined,
        analiseVersaoAtual:
          typeof data.analiseVersaoAtual === "number" ? data.analiseVersaoAtual : undefined,
      };
    })
    .filter((item) => String(item.numeroRevisao || "").toUpperCase() === prevLabel);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.createdAtMs - a.createdAtMs);
  const prev = candidates[0];

  return buildBlocoContextoAnaliseAnterior({
    tituloBloco: "CONTEXTO DA REVISÃO ANTERIOR DO MESMO PROCESSO",
    origemLabel: `revisão ${prevLabel} (solicitação ${prev.id})`,
    titulo: prev.titulo,
    versao: prev.analiseVersaoAtual ?? null,
    checklistConformidade: prev.checklistConformidade,
    parecerTecnico: prev.parecerTecnico,
    complementosChecklist: prev.complementosChecklist,
  });
}

/** Une memória da versão (mesma solicitação) + revisão do processo (R00→R01). */
function mergeContextosMemoria(
  contextoVersao: string | null,
  contextoRevisao: string | null,
): string | null {
  const partes = [contextoVersao, contextoRevisao].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  if (partes.length === 0) return null;
  return partes.join("\n\n═══════════════════════════════════════\n\n");
}

function aplicarLimitesPdf(
  pdfBuffers: Array<{ filename: string; buffer: Buffer; url?: string }>,
) {
  const incluidos: Array<{ filename: string; buffer: Buffer; url?: string }> = [];
  const omitidos: string[] = [];
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

function stripMarkdownFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function parseAIResponse(raw: string) {
  const candidates = [raw.trim(), stripMarkdownFence(raw)];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") continue;
      return {
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
        parecerTecnico:
          typeof parsed.parecerTecnico === "string" ? parsed.parecerTecnico : "Parecer não gerado.",
        dadosExtraidos:
          parsed.dadosExtraidos && typeof parsed.dadosExtraidos === "object"
            ? (parsed.dadosExtraidos as DadosExtraidosAnalise)
            : null,
        conferenciaInputs: Array.isArray(parsed.conferenciaInputs)
          ? parsed.conferenciaInputs.map((item) => {
              const raw = item as ConferenciaInput;
              return {
                ...raw,
                evidencia: parseEvidencia(raw.evidencia),
              };
            })
          : [],
      };
    } catch {
      // próximo candidato
    }
  }
  throw new Error("A IA retornou texto em vez de JSON estruturado.");
}

async function inferTipoRelatorio(
  pdfBuffers: Array<{ filename: string; buffer: Buffer }>,
): Promise<TipoRelatorio> {
  const parts: InputPart[] = [];
  for (const pdf of pdfBuffers.slice(0, 2)) {
    parts.push(buildFileInput(pdf.filename, pdf.buffer));
  }
  parts.push(buildTextInput(buildInferTipoPrompt()));
  const result = await analyze(parts, { maxOutputTokens: 50, temperature: 0 });
  const inferred = result.content.trim().toLowerCase();
  if (isValidTipo(inferred)) return inferred;
  if (inferred.includes("pit")) return "pit";
  if (inferred.includes("nao_per")) return "obra_nao_per";
  if (inferred.includes("per")) return "obra_per";
  return "pit";
}

export async function runAnaliseJob(params: {
  solicitacaoId: string;
  jobId: string;
  apiKey: string;
  collection?: string;
}) {
  const db = getFirestore();
  const COLLECTION = params.collection?.trim() || "solicitacoes";
  const solicitacaoRef = db.collection(COLLECTION).doc(params.solicitacaoId);
  const jobRef = solicitacaoRef.collection("analiseJobs").doc(params.jobId);

  initOpenAI(params.apiKey);

  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new Error("Job de análise não encontrado.");
    }
    const jobData = jobSnap.data()!;
    if (jobData.state !== "queued") {
      console.log(`Job ${params.jobId} ignorado (state=${jobData.state})`);
      return;
    }

    await jobRef.update({ startedAt: FieldValue.serverTimestamp() });
    await solicitacaoRef.update({
      status: "em_analise",
      activeAnaliseJobId: params.jobId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const snapshot = await solicitacaoRef.get();
    if (!snapshot.exists) throw new Error("Solicitação não encontrada.");
    const data = snapshot.data()!;

    const escopoAnalise = (jobData.escopoAnalise ?? {}) as EscopoAnalisePrompt;
    const tiposProjetoPraComparar = Array.isArray(jobData.tiposProjetoPraComparar)
      ? jobData.tiposProjetoPraComparar.filter((item: unknown) => isValidTipo(item))
      : [];
    const promptCustomizado =
      typeof jobData.promptCustomizado === "string" ? jobData.promptCustomizado.trim() : "";

    const arquivos: string[] = Array.isArray(data.arquivos) ? data.arquivos : [];
    const arquivosMeta = parseArquivosMeta(data.arquivosMeta);
    const concessionariaId = data.concessionariaId ? String(data.concessionariaId) : null;
    const perfilFirestore = await getConcessionariaPerfilFromFirestore(concessionariaId);
    const promptProfileFromFirestore =
      perfilFirestore?.promptProfile &&
      ["eco101", "motiva", "arteris"].includes(perfilFirestore.promptProfile)
        ? perfilFirestore.promptProfile
        : null;
    const promptProfileRaw =
      promptProfileFromFirestore ?? resolveConcessionariaPromptProfile(concessionariaId);
    const promptProfile =
      promptProfileRaw === "custom" ? "default" : promptProfileRaw;
    const isProfile =
      isProfileConcessionaria(concessionariaId) || Boolean(perfilFirestore?.perfilCompleto);

    await updateJob(jobRef, solicitacaoRef, "extracting", 28, "pdfs");

    const pdfUrls = arquivos.filter((url) => url.toLowerCase().includes(".pdf"));
    const pdfBuffersRaw: Array<{ filename: string; buffer: Buffer; url: string }> = [];
    for (const url of pdfUrls) {
      try {
        const buffer = await downloadStorageFile(url);
        pdfBuffersRaw.push({
          filename: extractFilenameFromUrl(url),
          buffer,
          url,
        });
      } catch (err) {
        console.error(`Erro ao baixar PDF: ${url}`, err);
      }
    }
    const { incluidos: pdfBuffers, omitidos: pdfsOmitidos } = aplicarLimitesPdf(pdfBuffersRaw);

    let tipoBase: TipoRelatorio;
    if (isValidTipo(data.tipoRelatorio)) {
      tipoBase = data.tipoRelatorio;
    } else if (pdfBuffers.length > 0) {
      tipoBase = await inferTipoRelatorio(pdfBuffers);
    } else {
      tipoBase = perfilFirestore?.tipoProjetoPadrao ?? "pit";
    }

    const tiposAnalise = Array.from(
      new Set<TipoRelatorio>(
        tiposProjetoPraComparar.length > 0 ? tiposProjetoPraComparar : [tipoBase],
      ),
    );

    const tiposConfig = tiposAnalise.map((tipo) => {
      const config = getTipoProjetoConfig(tipo);
      if (!config) throw new Error(`Configuração não encontrada para tipo: ${tipo}`);
      return { tipo, config };
    });

    await updateJob(jobRef, solicitacaoRef, "analyzing", 55, "normas");

    const tipoAnaliseId =
      typeof data.tipoAnaliseId === "string" ? data.tipoAnaliseId.trim() : "";
    const tipoAnaliseDescricao =
      typeof data.tipoAnaliseDescricao === "string"
        ? data.tipoAnaliseDescricao.trim()
        : "";
    const tipoAnaliseDoc = await getTipoAnaliseFromFirestore(tipoAnaliseId || null);

    const normasMap = new Map<
      string,
      { fonte: (ReturnType<typeof carregarNormasPDFParaTipo>[number])["fonte"]; buffer: Buffer }
    >();

    // Prioridade de normas: TipoAnalise → perfil concessionária → fallback por tipoRelatorio
    const normasDoTipo = tipoAnaliseDoc?.normasFontes?.filter(Boolean) ?? [];
    if (normasDoTipo.length > 0) {
      for (const norma of carregarNormasPDFPorFonteIds(normasDoTipo)) {
        normasMap.set(norma.fonte.id, norma);
      }
    } else if (perfilFirestore?.normasFontes?.length) {
      for (const norma of carregarNormasPDFPorFonteIds(perfilFirestore.normasFontes)) {
        normasMap.set(norma.fonte.id, norma);
      }
    } else {
      for (const tipo of tiposAnalise) {
        for (const norma of carregarNormasPDFParaTipo(tipo)) {
          normasMap.set(norma.fonte.id, norma);
        }
      }
    }
    const normasPDFs = Array.from(normasMap.values());

    const dadosForm: DadosFormulario = {
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

    const requisitosDoTipo = formatarRequisitosTipoAnalise(tipoAnaliseDoc);
    const requisitosPerfil = getRequisitosFromPerfil(perfilFirestore);
    const formatarRequisitosLegado = (tipo: TipoRelatorio) => {
      if (requisitosPerfil.length > 0) {
        return requisitosPerfil
          .map((r) => {
            const cat = r.categoria ? ` [${r.categoria}]` : "";
            return `- ${r.id}: ${r.descricao}${cat}`;
          })
          .join("\n");
      }
      return listarRequisitosFormatados(tipo, concessionariaId);
    };

    // Prioridade de checklist: TipoAnalise → perfil → catálogo PIT/PER (legado)
    let requisitosFormatados: string;
    if (requisitosDoTipo) {
      requisitosFormatados = `### ${tipoAnaliseDoc!.nome} (${tipoAnaliseDoc!.id})\n${requisitosDoTipo}`;
    } else if (isProfile) {
      requisitosFormatados = formatarRequisitosLegado(tipoBase);
    } else {
      requisitosFormatados = tiposConfig
        .map(
          ({ tipo, config }) =>
            `### ${config.nome} (${tipo})\n${formatarRequisitosLegado(tipo)}`,
        )
        .join("\n\n");
    }

    const tiposProjetoNome = [
      tipoAnaliseDoc ? `Tipo de análise: ${tipoAnaliseDoc.nome}` : null,
      perfilFirestore?.nome ??
        getProfileTipoProjetoNome(promptProfile) ??
        tiposConfig.map(({ config }) => config.nome).join(", "),
    ]
      .filter(Boolean)
      .join(" · ");

    const systemPrompt = buildProfileSystemPrompt(promptProfile);
    const promptCustomizadoComPerfil = [
      promptCustomizado,
      buildTipoAnalisePromptAddon(tipoAnaliseDoc, tipoAnaliseDescricao || null),
      perfilFirestore?.perfilCompleto ? buildCustomAnalysisPromptAddon(perfilFirestore) : "",
    ]
      .filter(Boolean)
      .join("\n");

    let contextoMemoriaAnterior: string | null = null;
    try {
      const contextoVersao = loadContextoVersaoAnteriorMesmaSolicitacao(
        params.solicitacaoId,
        data as Record<string, unknown>,
      );
      let contextoRevisao: string | null = null;
      try {
        contextoRevisao = await loadContextoRevisaoAnterior(
          params.solicitacaoId,
          data.processoId ? String(data.processoId) : null,
          data.numeroRevisao ? String(data.numeroRevisao) : null,
        );
      } catch (ctxErr) {
        console.warn("Falha ao carregar contexto da revisão anterior do processo:", ctxErr);
      }
      contextoMemoriaAnterior = mergeContextosMemoria(contextoVersao, contextoRevisao);
      if (contextoMemoriaAnterior) {
        console.log(
          `Contexto de memória/reanálise carregado para solicitação ${params.solicitacaoId}` +
            `${contextoVersao ? " [versão]" : ""}${contextoRevisao ? " [revisão]" : ""}`,
        );
      }
    } catch (ctxErr) {
      console.warn("Falha ao carregar contexto de memória da análise anterior:", ctxErr);
    }

    let feedbackBlock = "";
    let feedbackIdsInjetados: string[] = [];
    let goldenBlock = "";
    let goldenCaseIdsInjetados: string[] = [];
    if (tipoAnaliseId) {
      try {
        const feedbacks = await listFeedbacksAprovadosParaAnalise({
          tipoAnaliseId,
          organizacaoId: concessionariaId,
          maxItems: 8,
        });
        feedbackBlock = buildFeedbackAprendizadoPromptBlock(feedbacks);
        feedbackIdsInjetados = feedbacks.map((item) => item.id);
        if (feedbackIdsInjetados.length > 0) {
          console.log(
            `Feedbacks aprovados injetados (${feedbackIdsInjetados.length}) para tipo ${tipoAnaliseId}: ${feedbackIdsInjetados.join(", ")}`,
          );
        }
      } catch (fbErr) {
        console.warn("Falha ao carregar feedbacks de aprendizado:", fbErr);
      }

      try {
        const goldens = await listGoldenCasesAprovadosParaAnalise({
          tipoAnaliseId,
          organizacaoId: concessionariaId,
          maxItems: 3,
        });
        goldenBlock = buildGoldenCasesPromptBlock(goldens);
        goldenCaseIdsInjetados = goldens.map((item) => item.id);
        if (goldenCaseIdsInjetados.length > 0) {
          console.log(
            `Golden cases injetados (${goldenCaseIdsInjetados.length}) para tipo ${tipoAnaliseId}: ${goldenCaseIdsInjetados.join(", ")}`,
          );
        }
      } catch (gcErr) {
        console.warn("Falha ao carregar golden cases:", gcErr);
      }
    }

    const analysisPrompt = buildProfileAnalysisPrompt({
      profile: promptProfile,
      dados: dadosForm,
      requisitosFormatados,
      tiposAnalise,
      tiposProjetoNome,
      escopo: escopoAnalise,
      promptCustomizado: promptCustomizadoComPerfil || undefined,
      contextoRevisaoAnterior: contextoMemoriaAnterior || undefined,
      feedbackAprendizado: feedbackBlock || undefined,
      goldenCases: goldenBlock || undefined,
      exemploSaidaEsperada:
        promptProfile === "eco101" ? buildEco101ExemploAnaliseBlock() : undefined,
    });

    await updateJob(jobRef, solicitacaoRef, "analyzing", 68, "checklist");

    const parts: InputPart[] = [buildTextInput(systemPrompt)];
    for (const norma of normasPDFs) {
      parts.push(buildFileInput(norma.fonte.pdf, norma.buffer));
      parts.push(
        buildTextInput(`[NORMA DE REFERÊNCIA: ${norma.fonte.titulo} — ${norma.fonte.orgao}]`),
      );
    }
    if (escopoAnalise.incluirDocumentosProjeto) {
      for (const pdf of pdfBuffers) {
        parts.push(buildFileInput(pdf.filename, pdf.buffer));
        parts.push(
          buildTextInput(buildDocumentoProjetoLabel(pdf.filename, arquivosMeta, pdf.url)),
        );
      }
      if (pdfsOmitidos.length > 0) {
        parts.push(
          buildTextInput(
            `[AVISO: PDFs omitidos por limite: ${pdfsOmitidos.join("; ")}]`,
          ),
        );
      }
    }
    parts.push(buildTextInput(analysisPrompt));

    await updateJob(jobRef, solicitacaoRef, "generating_report", 85, "parecer");

    const result = await analyze(parts, {
      maxOutputTokens: isProfile ? 16000 : 12000,
      temperature: 0.1,
      jsonMode: true,
    });

    const parsed = parseAIResponse(result.content);
    const checklistFinal = escopoAnalise.gerarChecklistConformidade ? parsed.checklist : [];
    const parecerFinal = escopoAnalise.gerarParecerTecnico ? parsed.parecerTecnico : "";
    const conferenciaFinal = complementarConferenciaDeterministica(
      parsed.conferenciaInputs,
      {
        interessado: dadosForm.interessado,
        rodovia: dadosForm.rodovia,
        kilometragem: dadosForm.kilometragem,
        municipioEstado: dadosForm.municipioEstado,
        uf: dadosForm.uf,
        extensao: dadosForm.extensao,
        numeroArt: dadosForm.numeroArt,
        responsavelTecnico: dadosForm.responsavelTecnico,
        tipoIntervencaoDetalhado: dadosForm.tipoIntervencaoDetalhado,
      },
      parsed.dadosExtraidos,
    );

    // Snapshot da versão anterior (se existir) + grava versão atual antes de sobrescrever no doc pai
    const snapAntes = await solicitacaoRef.get();
    const dataAntes = snapAntes.data() || {};
    const versaoAnterior =
      typeof dataAntes.analiseVersaoAtual === "number" ? dataAntes.analiseVersaoAtual : 0;
    const novaVersao = versaoAnterior + 1;
    const versoesRef = solicitacaoRef.collection("analiseVersoes");

    if (
      versaoAnterior > 0 ||
      dataAntes.parecerTecnico ||
      dataAntes.checklistConformidade ||
      dataAntes.relatorioIA
    ) {
      // Preserva o estado anterior como versão N (se ainda não havia contador, vira v1)
      const versaoParaArquivar = versaoAnterior > 0 ? versaoAnterior : 1;
      await versoesRef.doc(`v${versaoParaArquivar}`).set(
        {
          solicitacaoId: params.solicitacaoId,
          versao: versaoParaArquivar,
          jobId: dataAntes.activeAnaliseJobId ?? null,
          tipoAnaliseId: dataAntes.tipoAnaliseId ?? null,
          tipoRelatorio: dataAntes.tipoRelatorio ?? null,
          parecerTecnico: dataAntes.parecerTecnico ?? null,
          checklistConformidade: dataAntes.checklistConformidade ?? null,
          relatorioIA: dataAntes.relatorioIA ?? null,
          createdAt: FieldValue.serverTimestamp(),
          arquivadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const versaoCorrente = versaoAnterior > 0 ? novaVersao : 1;
    await versoesRef.doc(`v${versaoCorrente}`).set({
      solicitacaoId: params.solicitacaoId,
      versao: versaoCorrente,
      jobId: params.jobId,
      tipoAnaliseId: tipoAnaliseId || dataAntes.tipoAnaliseId || null,
      tipoAnaliseNome: tipoAnaliseDoc?.nome ?? null,
      tipoRelatorio: tipoBase,
      parecerTecnico: escopoAnalise.gerarParecerTecnico ? parecerFinal : null,
      checklistConformidade: escopoAnalise.gerarChecklistConformidade
        ? JSON.stringify(checklistFinal)
        : null,
      relatorioIA: result.content,
      promptCustomizado: promptCustomizado || null,
      feedbackIdsInjetados,
      goldenCaseIdsInjetados,
      createdAt: FieldValue.serverTimestamp(),
    });

    await solicitacaoRef.update({
      status: "em_analise",
      tipoRelatorio: tipoBase,
      tiposProjetoComparados: tiposAnalise,
      tipoAnaliseIdUsado: tipoAnaliseId || null,
      tipoAnaliseNomeUsado: tipoAnaliseDoc?.nome ?? null,
      escopoAnalise,
      relatorioIA: result.content,
      dadosExtraidos: parsed.dadosExtraidos,
      conferenciaInputs: conferenciaFinal,
      checklistConformidade: escopoAnalise.gerarChecklistConformidade
        ? JSON.stringify(checklistFinal)
        : null,
      parecerTecnico: escopoAnalise.gerarParecerTecnico ? parecerFinal : null,
      analisadoPorIA: true,
      analisadoEm: FieldValue.serverTimestamp(),
      activeAnaliseJobId: null,
      analiseJobStatus: "completed",
      analiseJobProgress: 100,
      analiseVersaoAtual: versaoCorrente,
      feedbackIdsInjetados,
      goldenCaseIdsInjetados,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await jobRef.update({
      state: "completed",
      progress: 100,
      stage: "final",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na análise.";
    console.error(`Job ${params.jobId} falhou:`, error);

    await jobRef.update({
      state: "failed",
      progress: 0,
      stage: "prep",
      error: { code: "analysis_failed", message },
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await solicitacaoRef.update({
      status: "pendente",
      activeAnaliseJobId: null,
      analiseJobStatus: "failed",
      analiseJobProgress: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
