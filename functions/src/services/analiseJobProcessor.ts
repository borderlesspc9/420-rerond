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
import {
  complementarConferenciaDeterministica,
  type ConferenciaInput,
  type DadosExtraidosAnalise,
} from "./consistencyAnalyzer";
import {
  buildCustomAnalysisPromptAddon,
  getConcessionariaPerfilFromFirestore,
  getRequisitosFromPerfil,
} from "./concessionariaPerfilService";

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
  return `[DOCUMENTO DO PROJETO: tipoDocumento=${tipo}; arquivo=${nome}]`;
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
          ? (parsed.conferenciaInputs as ConferenciaInput[])
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

    const normasMap = new Map<
      string,
      { fonte: (ReturnType<typeof carregarNormasPDFParaTipo>[number])["fonte"]; buffer: Buffer }
    >();

    if (perfilFirestore?.normasFontes?.length) {
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

    const requisitosPerfil = getRequisitosFromPerfil(perfilFirestore);
    const formatarRequisitos = (tipo: TipoRelatorio) => {
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

    const requisitosFormatados = isProfile
      ? formatarRequisitos(tipoBase)
      : tiposConfig
          .map(
            ({ tipo, config }) =>
              `### ${config.nome} (${tipo})\n${formatarRequisitos(tipo)}`,
          )
          .join("\n\n");

    const tiposProjetoNome =
      perfilFirestore?.nome ??
      getProfileTipoProjetoNome(promptProfile) ??
      tiposConfig.map(({ config }) => config.nome).join(", ");

    const systemPrompt = buildProfileSystemPrompt(promptProfile);
    const promptCustomizadoComPerfil = [
      promptCustomizado,
      perfilFirestore?.perfilCompleto ? buildCustomAnalysisPromptAddon(perfilFirestore) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const analysisPrompt = buildProfileAnalysisPrompt({
      profile: promptProfile,
      dados: dadosForm,
      requisitosFormatados,
      tiposAnalise,
      tiposProjetoNome,
      escopo: escopoAnalise,
      promptCustomizado: promptCustomizadoComPerfil || undefined,
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
      analisadoEm: FieldValue.serverTimestamp(),
      activeAnaliseJobId: null,
      analiseJobStatus: "completed",
      analiseJobProgress: 100,
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
