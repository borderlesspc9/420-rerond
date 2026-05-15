import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
  buildSystemPrompt,
  buildAnalysisPrompt,
  buildInferTipoPrompt,
  type DadosFormulario,
  type EscopoAnalisePrompt,
} from "./config/prompts";

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

function parseAIResponse(raw: string): {
  checklist: unknown[];
  parecerTecnico: string;
} {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  return {
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    parecerTecnico:
      typeof parsed.parecerTecnico === "string"
        ? parsed.parecerTecnico
        : "Parecer não gerado.",
  };
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
    timeoutSeconds: 540,
    memory: "1GiB",
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

    const apiKey =
      openaiApiKey.value()?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY não configurada. Defina o secret no Firebase ou OPENAI_API_KEY no emulador.",
      );
    }
    initOpenAI(apiKey);

    const docRef = db.collection(COLLECTION).doc(solicitacaoId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada.");
    }

    const data = snapshot.data()!;
    const arquivos: string[] = Array.isArray(data.arquivos)
      ? data.arquivos
      : [];

    await docRef.update({
      status: "em_analise",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const pdfUrls = arquivos.filter((url) =>
        url.toLowerCase().includes(".pdf"),
      );

      console.log(`Baixando ${pdfUrls.length} PDF(s) do projeto...`);
      const pdfBuffers: Array<{ filename: string; buffer: Buffer }> = [];

      for (const url of pdfUrls) {
        try {
          const buffer = await downloadStorageFile(url);
          const filename = extractFilenameFromUrl(url);
          pdfBuffers.push({ filename, buffer });
          console.log(`  OK: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
        } catch (err) {
          console.error(`  ERRO ao baixar: ${url}`, err);
        }
      }

      let tipoBase: TipoRelatorio;
      if (isValidTipo(data.tipoRelatorio)) {
        tipoBase = data.tipoRelatorio;
        console.log(`Tipo de relatório (formulário): ${tipoBase}`);
      } else {
        if (pdfBuffers.length > 0) {
          console.log("tipoRelatorio não informado, inferindo via IA...");
          tipoBase = await inferTipoRelatorio(pdfBuffers);
          console.log(`Tipo inferido: ${tipoBase}`);
        } else {
          tipoBase = "pit";
          console.log("Sem PDFs para inferência; usando tipo padrão 'pit'.");
        }
      }

      const tiposAnalise = Array.from(
        new Set<TipoRelatorio>(
          tiposProjetoPraComparar.length > 0
            ? tiposProjetoPraComparar
            : [tipoBase],
        ),
      );
      console.log(`Tipos de análise selecionados: ${tiposAnalise.join(", ")}`);

      const tiposConfig = tiposAnalise.map((tipo) => {
        const config = getTipoProjetoConfig(tipo);
        if (!config) {
          throw new HttpsError(
            "internal",
            `Configuração não encontrada para tipo: ${tipo}`,
          );
        }
        return { tipo, config };
      });

      const normasMap = new Map<
        string,
        { fonte: (ReturnType<typeof carregarNormasPDFParaTipo>[number])["fonte"]; buffer: Buffer }
      >();
      for (const tipo of tiposAnalise) {
        const normasDoTipo = carregarNormasPDFParaTipo(tipo);
        for (const norma of normasDoTipo) {
          normasMap.set(norma.fonte.id, norma);
        }
      }
      const normasPDFs = Array.from(normasMap.values());
      console.log(`Normas carregadas: ${normasPDFs.length}`);

      const dadosForm: DadosFormulario = {
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

      const requisitosFormatados = tiposConfig
        .map(
          ({ tipo, config }) =>
            `### ${config.nome} (${tipo})\n${listarRequisitosFormatados(tipo)}`,
        )
        .join("\n\n");
      const tiposProjetoNome = tiposConfig
        .map(({ config }) => config.nome)
        .join(", ");
      const systemPrompt = buildSystemPrompt();
      const analysisPrompt = buildAnalysisPrompt(
        dadosForm,
        tiposAnalise,
        requisitosFormatados,
        tiposProjetoNome,
        escopoAnalise,
        promptCustomizado,
      );

      const parts: InputPart[] = [];

      parts.push(buildTextInput(systemPrompt));

      for (const norma of normasPDFs) {
        parts.push(buildFileInput(norma.fonte.pdf, norma.buffer));
        parts.push(
          buildTextInput(
            `[NORMA DE REFERÊNCIA: ${norma.fonte.titulo} — ${norma.fonte.orgao}]`,
          ),
        );
      }

      if (escopoAnalise.incluirDocumentosProjeto) {
        for (const pdf of pdfBuffers) {
          parts.push(buildFileInput(pdf.filename, pdf.buffer));
          parts.push(
            buildTextInput(`[DOCUMENTO DO PROJETO: ${pdf.filename}]`),
          );
        }
      }

      parts.push(buildTextInput(analysisPrompt));

      console.log(
        `Enviando para OpenAI: ${normasPDFs.length} norma(s) + ${
          escopoAnalise.incluirDocumentosProjeto ? pdfBuffers.length : 0
        } PDF(s) do projeto`,
      );
      const result = await analyze(parts, {
        maxOutputTokens: 8000,
        temperature: 0.1,
      });

      console.log(
        `Resposta recebida. Modelo: ${result.model}, Tokens: ${result.tokensUsed ?? "N/A"}`,
      );

      const { checklist, parecerTecnico } = parseAIResponse(result.content);
      const checklistFinal = escopoAnalise.gerarChecklistConformidade ? checklist : [];
      const parecerFinal = escopoAnalise.gerarParecerTecnico ? parecerTecnico : "";

      await docRef.update({
        status: "em_analise",
        tipoRelatorio: tipoBase,
        tiposProjetoComparados: tiposAnalise,
        escopoAnalise,
        relatorioIA: result.content,
        checklistConformidade: escopoAnalise.gerarChecklistConformidade
          ? JSON.stringify(checklistFinal)
          : null,
        parecerTecnico: escopoAnalise.gerarParecerTecnico ? parecerFinal : null,
        analisadoPorIA: true,
        analisadoEm: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updatedSnap = await docRef.get();
      const updatedData = updatedSnap.data()!;

      return {
        id: solicitacaoId,
        ...updatedData,
        arquivos: Array.isArray(updatedData.arquivos)
          ? updatedData.arquivos
          : [],
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() ?? null,
        analisadoEm:
          updatedData.analisadoEm?.toDate?.()?.toISOString() ?? null,
      };
    } catch (error: unknown) {
      console.error("Erro na análise:", error);

      await docRef.update({
        status: "pendente",
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (error instanceof HttpsError) throw error;

      const message =
        error instanceof Error ? error.message : "Erro desconhecido na análise.";
      throw new HttpsError("internal", message);
    }
  },
);
