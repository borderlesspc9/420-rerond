/**
 * Serviço de análise de solicitações com IA (GPT-4o Vision para PDFs)
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { getAIConfig, type ChatMessage } from "./aiProvider.js";
import {
  initializeGroq,
  createChatCompletion as groqChatCompletion,
} from "./groqService.js";
import {
  initializeOpenAI,
  createChatCompletion as openaiChatCompletion,
} from "./openaiService.js";

const execFileAsync = promisify(execFile);
const PDFTOPPM_EXECUTABLE = process.env.PDFTOPPM_PATH || "pdftoppm";
const MOCK_OPENAI_VISION = process.env.MOCK_OPENAI_VISION === "true";

// Limite de tokens para controlar custo (explícito)
const MAX_TOKENS_ANALISE = 2000;
const MAX_PAGINAS_PDF = 10; // Limita a quantidade de páginas enviadas por PDF

// Inicializar provider de IA
let aiInitialized = false;

function initializeAI() {
  if (aiInitialized) return;

  try {
    const config = getAIConfig();
    if (config.provider === "groq") {
      initializeGroq(config.apiKey);
      console.log(`✅ Groq inicializado com modelo: ${config.model}`);
    } else {
      initializeOpenAI(config.apiKey);
      console.log(`✅ OpenAI inicializado com modelo: ${config.model}`);
    }
    aiInitialized = true;
  } catch (error: any) {
    console.warn(`⚠️  IA não configurada: ${error.message}`);
    console.warn(
      `⚠️  Configure GROQ_API_KEY ou OPENAI_API_KEY no arquivo .env`,
    );
  }
}

// Não inicializar na importação - dotenv ainda não foi carregado neste momento.
// A inicialização ocorre de forma lazy na primeira chamada que precisar da IA.

/**
 * Converte um PDF em array de imagens base64 usando Poppler (pdftoppm).
 */
async function pdfParaImagens(filePath: string): Promise<string[]> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-pages-"));
  const outputPrefix = path.join(
    tempDir,
    path.basename(filePath, path.extname(filePath)),
  );

  try {
    // pdftoppm -f 1 -l N limita páginas para controlar custo.
    await execFileAsync(PDFTOPPM_EXECUTABLE, [
      "-jpeg",
      "-f",
      "1",
      "-l",
      String(MAX_PAGINAS_PDF),
      filePath,
      outputPrefix,
    ]);

    const imageFiles = fs
      .readdirSync(tempDir)
      .filter(
        (file) =>
          file.toLowerCase().endsWith(".jpg") ||
          file.toLowerCase().endsWith(".jpeg"),
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imageFiles.length === 0) {
      throw new Error("Nenhuma imagem foi gerada pelo Poppler (pdftoppm).");
    }

    const totalPaginas = imageFiles.length;

    console.log(
      `📄 PDF: ${path.basename(filePath)} | Páginas convertidas: ${totalPaginas}`,
    );

    const imagens = imageFiles.map((fileName, index) => {
      const imagePath = path.join(tempDir, fileName);
      const base64 = fs.readFileSync(imagePath).toString("base64");
      console.log(
        `  📷 Página ${index + 1}/${totalPaginas} convertida (${Math.round((base64.length * 0.75) / 1024)} KB)`,
      );
      return base64;
    });

    if (totalPaginas >= MAX_PAGINAS_PDF) {
      console.warn(
        `⚠️  Limite de ${MAX_PAGINAS_PDF} página(s) atingido para controle de custo. Páginas adicionais foram ignoradas.`,
      );
    }

    return imagens;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Poppler não encontrado (${PDFTOPPM_EXECUTABLE}). Instale poppler-utils no ambiente local/produção, adicione ao PATH ou configure PDFTOPPM_PATH no .env.`,
      );
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export interface AnaliseSolicitacaoParams {
  titulo: string;
  tipoObra: string;
  localizacao: string;
  descricao: string;
  arquivosPaths: string[];
  promptCustomizado?: string;
  cliente?: string;
  kilometragem?: string;
  nroProcessoErp?: string;
  rodovia?: string;
  nomeConcessionaria?: string;
  sentido?: string;
  ocupacao?: string;
  municipioEstado?: string;
  ocupacaoArea?: string;
  responsavelTecnico?: string;
  faseProjeto?: string;
  analistaResponsavel?: string;
  memorial?: string;
  dataRecebimento?: string;
}

const v = (s: string | undefined) => s ?? "não informado";

const normalizarPromptTexto = (texto: string): string => {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

/**
 * Gera o prompt padrão para análise de solicitações (comparação formulário x PDFs)
 */
function gerarPromptPadrao(params: AnaliseSolicitacaoParams): string {
  return `Compare os dados do formulário com os documentos anexados e responda APENAS em JSON.

FORMULÁRIO:
Cliente: ${v(params.cliente)}
Kilometragem: ${v(params.kilometragem)}
Nro Processo ERP: ${v(params.nroProcessoErp)}
Rodovia: ${v(params.rodovia)}
Nome Concessionária: ${v(params.nomeConcessionaria)}
Sentido: ${v(params.sentido)}
Ocupação: ${v(params.ocupacao)}
Município - Estado: ${v(params.municipioEstado)}
Ocupação Área: ${v(params.ocupacaoArea)}
Responsável Técnico: ${v(params.responsavelTecnico)}
Fase do Projeto: ${v(params.faseProjeto)}
Analista Responsável: ${v(params.analistaResponsavel)}
Memorial: ${v(params.memorial)}
Data de Recebimento: ${v(params.dataRecebimento)}
Título: ${params.titulo}
Tipo de Obra: ${params.tipoObra}
Localização: ${params.localizacao}
Descrição: ${params.descricao}

REGRAS:
- Para cada campo, use somente "ok" ou "informações não batem; [motivo curto]".
- Se faltar evidência no documento, use "informações não batem".
- Não invente dados.

CHAVES JSON (exatas): LOCALIZACAO, KM_INICIO, KM_FIM, NOME_BR, COORDENADAS_GEORREFERENCIAIS_E, COORDENADAS_GEORREFERENCIAIS_N, TRACADO_FAIXA_DOMINIO, COTAS_TEXTOS_LEGIVEIS, VERIFICACAO_ESCALA, MEMORIAL, LARGURA_PISTA_DNIT, LEGENDAS, ANOTACAO_NOTA, SIGLA_ABREVIACAO, LOC_KM_PREFIXO, CARIMBO_CORRETO, LIMITE_PROPRIEDADE, DELIMITACAO_DOMINIO_NAO_EDIFICANTE, ART_PDF, QTD_FOLHAS.

Retorne somente o objeto JSON, sem texto extra.`;
}

/**
 * Analisa uma solicitação usando GPT-4o Vision para PDFs + fallback texto para Groq
 */
export async function analisarSolicitacaoComIA(
  params: AnaliseSolicitacaoParams,
): Promise<string> {
  if (!aiInitialized) {
    try {
      initializeAI();
    } catch (error: any) {
      throw new Error(
        "Nenhum provider de IA configurado. Configure GROQ_API_KEY ou OPENAI_API_KEY no arquivo .env",
      );
    }
  }

  const config = getAIConfig();
  const promptBaseBruto = params.promptCustomizado || gerarPromptPadrao(params);
  const promptBase = normalizarPromptTexto(promptBaseBruto);
  const pdfPaths = params.arquivosPaths.filter((p) =>
    p.toLowerCase().endsWith(".pdf"),
  );

  console.log(`\n🤖 Iniciando análise com IA`);
  console.log(`   Provider: ${config.provider} | Modelo: ${config.model}`);
  console.log(
    `   Limite de tokens (MAX_TOKENS_ANALISE): ${MAX_TOKENS_ANALISE}`,
  );
  console.log(`   Tamanho do prompt textual: ${promptBase.length} caracteres`);
  console.log(`   PDFs para processar: ${pdfPaths.length}`);

  // Se há PDFs e o provider é OpenAI, usa Vision
  if (pdfPaths.length > 0 && config.provider === "openai") {
    return analisarComVision(pdfPaths, promptBase, config);
  }

  // Caso sem PDFs ou com Groq — análise só pelo formulário
  if (pdfPaths.length > 0 && config.provider === "groq") {
    const avisoSemVisao =
      "Analise parcial: provider atual sem visao de PDF. A avaliacao foi feita sem leitura visual das paginas anexadas.";
    console.warn(
      `⚠️  Groq não suporta visão. PDFs serão ignorados. Configure OPENAI_API_KEY para análise visual dos documentos.`,
    );

    return analisarSemVision(promptBase, config, avisoSemVisao);
  }

  return analisarSemVision(promptBase, config);
}

/**
 * Análise via GPT-4o Vision — envia páginas do PDF como imagens
 */
async function analisarComVision(
  pdfPaths: string[],
  promptBase: string,
  config: ReturnType<typeof getAIConfig>,
): Promise<string> {
  const openai = new OpenAI({ apiKey: config.apiKey });
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

  // Adiciona o prompt de texto primeiro
  content.push({ type: "text", text: promptBase });

  let totalPaginas = 0;
  for (const pdfPath of pdfPaths) {
    console.log(`\n📂 Processando PDF: ${path.basename(pdfPath)}`);
    try {
      const imagens = await pdfParaImagens(pdfPath);
      totalPaginas += imagens.length;

      for (let i = 0; i < imagens.length; i++) {
        content.push({
          type: "text",
          text: `--- Página ${i + 1} do arquivo ${path.basename(pdfPath)} ---`,
        });
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imagens[i]}`,
            detail: "auto",
          },
        });
      }
    } catch (error: any) {
      console.error(
        `❌ Erro ao processar PDF ${path.basename(pdfPath)}: ${error.message}`,
      );
      content.push({
        type: "text",
        text: `[Erro ao processar ${path.basename(pdfPath)}: ${error.message}]`,
      });
    }
  }

  console.log(`\n📤 Enviando ${totalPaginas} página(s) para GPT-4o Vision...`);
  console.log(`   Limite máximo de tokens na resposta: ${MAX_TOKENS_ANALISE}`);

  if (MOCK_OPENAI_VISION) {
    console.warn(
      "🧪 MOCK_OPENAI_VISION=true: simulando resposta do GPT-4o Vision (sem chamada externa).",
    );
    const mockResponse = {
      LOCALIZACAO: "ok",
      KM_INICIO: "ok",
      KM_FIM: "ok",
      NOME_BR: "ok",
      COORDENADAS_GEORREFERENCIAIS_E: "ok",
      COORDENADAS_GEORREFERENCIAIS_N: "ok",
      TRACADO_FAIXA_DOMINIO: "ok",
      COTAS_TEXTOS_LEGIVEIS: "ok",
      VERIFICACAO_ESCALA: "ok",
      MEMORIAL: "ok",
      LARGURA_PISTA_DNIT: "ok",
      LEGENDAS: "ok",
      ANOTACAO_NOTA: "ok",
      SIGLA_ABREVIACAO: "ok",
      LOC_KM_PREFIXO: "ok",
      CARIMBO_CORRETO: "ok",
      LIMITE_PROPRIEDADE: "ok",
      DELIMITACAO_DOMINIO_NAO_EDIFICANTE: "ok",
      ART_PDF: "ok",
      QTD_FOLHAS: `${totalPaginas}`,
      _mock: true,
      _provider: "openai-vision-mock",
      _observacao:
        "Resposta simulada para teste de fluxo sem consumir cota da OpenAI.",
    };
    const resultadoMock = JSON.stringify(mockResponse, null, 2);
    console.log(`\n✅ Análise Vision simulada concluída`);
    console.log(`\n📋 Resposta simulada da IA:\n${resultadoMock}\n`);
    return resultadoMock;
  }

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em análise de projetos de infraestrutura rodoviária. Analise visualmente os documentos e forneça análises detalhadas e precisas.",
        },
        { role: "user", content },
      ],
      max_tokens: MAX_TOKENS_ANALISE,
      temperature: 0.2,
    });

    const resultado = response.choices[0]?.message?.content;
    if (!resultado) throw new Error("GPT-4o Vision não retornou resposta");

    const tokensUsados = response.usage?.total_tokens ?? 0;
    const tokensResposta = response.usage?.completion_tokens ?? 0;
    const tokensPrompt = response.usage?.prompt_tokens ?? 0;

    console.log(`\n✅ Análise Vision concluída`);
    console.log(
      `   Tokens usados — prompt: ${tokensPrompt} | resposta: ${tokensResposta} | total: ${tokensUsados}`,
    );
    console.log(
      `   Custo estimado: ~$${(tokensPrompt * 0.000005 + tokensResposta * 0.000015).toFixed(4)} USD`,
    );
    console.log(`\n📋 Resposta da IA:\n${resultado}\n`);

    return resultado;
  } catch (error: any) {
    console.error(`\n❌ Erro na comunicação com GPT-4o Vision:`);
    console.error(`   Status: ${error.status ?? "desconhecido"}`);
    console.error(`   Código: ${error.code ?? "desconhecido"}`);
    console.error(`   Mensagem: ${error.message}`);
    if (error.code === "insufficient_quota")
      throw new Error("Cota da API OpenAI esgotada. Verifique sua conta.");
    if (error.status === 429)
      throw new Error(
        "Limite de requisições do OpenAI excedido. Tente novamente mais tarde.",
      );
    if (error.code === "invalid_api_key")
      throw new Error("Chave da API OpenAI inválida.");
    throw new Error(`Erro no GPT-4o Vision: ${error.message}`);
  }
}

/**
 * Análise sem visão (Groq ou OpenAI texto) — só formulário
 */
async function analisarSemVision(
  promptBase: string,
  config: ReturnType<typeof getAIConfig>,
  avisoSemVisao?: string,
): Promise<string> {
  const avisoInstrucao = avisoSemVisao
    ? `\n\nAVISO OBRIGATORIO NO RESULTADO: inclua em metadados.aviso o texto exato: "${avisoSemVisao}".`
    : "";

  const mensagem = `${promptBase}\n\nNenhum documento foi anexado ou o provider atual não suporta visão. Gere a análise com base apenas nos dados do formulário.${avisoInstrucao}`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Você é um especialista em análise de projetos de infraestrutura rodoviária.",
    },
    { role: "user", content: mensagem },
  ];

  console.log(`\n📤 Enviando análise de texto para ${config.provider}...`);
  console.log(`   Limite máximo de tokens na resposta: ${MAX_TOKENS_ANALISE}`);

  try {
    const completion =
      config.provider === "groq"
        ? await groqChatCompletion(messages, config.model, {
            temperature: 0.2,
            maxTokens: MAX_TOKENS_ANALISE,
          })
        : await openaiChatCompletion(messages, config.model, {
            temperature: 0.2,
            maxTokens: MAX_TOKENS_ANALISE,
          });

    console.log(
      `\n✅ Análise concluída — ${completion.provider} (${completion.model})`,
    );
    console.log(`\n📋 Resposta da IA:\n${completion.content}\n`);

    return completion.content;
  } catch (error: any) {
    console.error(`\n❌ Erro na comunicação com ${config.provider}:`);
    console.error(`   Mensagem: ${error.message}`);
    throw error;
  }
}

/**
 * Obtém informações sobre o provider atual
 */
export function getAIProviderInfo(): {
  provider: string;
  model: string;
  available: boolean;
} {
  try {
    const config = getAIConfig();
    return {
      provider: config.provider,
      model: config.model,
      available: aiInitialized,
    };
  } catch {
    return {
      provider: "none",
      model: "none",
      available: false,
    };
  }
}
