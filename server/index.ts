import express, { type Request } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import archiver from "archiver";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  analisarSolicitacaoComIA,
  getAIProviderInfo,
} from "./services/aiService.js";
import {
  obterPromptAtivo,
  processarPrompt,
  comporPromptComNormas,
  carregarPrompts,
  obterPromptPorId,
  salvarPrompts,
} from "./services/promptService.js";
import {
  parseTiposProjetoPraComparar,
  obterNormasSelecionadas,
  montarBlocoNormativoParaPrompt,
} from "./services/normasService.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "src/.env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const normalizarPromptTexto = (texto: string): string => {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const getPublicBaseUrl = (req: Request) => {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  const host = req.get("host") || `localhost:${PORT}`;
  return `${req.protocol}://${host}`;
};

const buildUploadUrl = (req: Request, filename: string) => {
  return `${getPublicBaseUrl(req)}/uploads/${filename}`;
};

// Middleware
app.set("trust proxy", true);
app.use(
  cors({
    origin: "*", // Em produção, especifique as origens permitidas
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Servidor rodando" });
});

// GET /api/ai/info - Informações sobre o provider de IA ativo
app.get("/api/ai/info", (req, res) => {
  try {
    const info = getAIProviderInfo();
    res.json(info);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao obter informações do provider de IA" });
  }
});

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido"));
    }
  },
});

// Multer específico para PDFs apenas (usado na análise)
const uploadPDFs = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são permitidos para análise"));
    }
  },
});

// Rotas

// GET /api/solicitacoes - Listar todas as solicitações
app.get("/api/solicitacoes", async (req, res) => {
  try {
    const solicitacoes = await prisma.solicitacao.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Converter arquivos de JSON string para array
    const solicitacoesComArquivos = solicitacoes.map((s) => ({
      ...s,
      arquivos: s.arquivos ? JSON.parse(s.arquivos) : [],
      relatorioIA: s.relatorioIA || null,
    }));

    res.json(solicitacoesComArquivos);
  } catch (error) {
    console.error("Erro ao buscar solicitações:", error);
    res.status(500).json({ error: "Erro ao buscar solicitações" });
  }
});

// GET /api/solicitacoes/:id - Buscar solicitação por ID
app.get("/api/solicitacoes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
    });

    if (!solicitacao) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    res.json({
      ...solicitacao,
      arquivos: solicitacao.arquivos ? JSON.parse(solicitacao.arquivos) : [],
      relatorioIA: solicitacao.relatorioIA || null,
    });
  } catch (error) {
    console.error("Erro ao buscar solicitação:", error);
    res.status(500).json({ error: "Erro ao buscar solicitação" });
  }
});

// POST /api/solicitacoes - Criar nova solicitação
app.post("/api/solicitacoes", upload.array("files"), async (req, res) => {
  try {
    const {
      titulo,
      tipoObra,
      localizacao,
      descricao,
      status,
      createdBy,
      cliente,
      kilometragem,
      nroProcessoErp,
      rodovia,
      nomeConcessionaria,
      sentido,
      ocupacao,
      municipioEstado,
      ocupacaoArea,
      responsavelTecnico,
      faseProjeto,
      analistaResponsavel,
      memorial,
      dataRecebimento,
    } = req.body;

    if (!titulo || !tipoObra || !localizacao || !descricao) {
      return res.status(400).json({
        error: "Campos obrigatórios: titulo, tipoObra, localizacao, descricao",
      });
    }

    // Processar arquivos enviados
    const arquivosUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      arquivosUrls.push(
        ...req.files.map(
          (file: Express.Multer.File) => buildUploadUrl(req, file.filename),
        ),
      );
    }

    const solicitacao = await prisma.solicitacao.create({
      data: {
        titulo,
        tipoObra,
        localizacao,
        descricao,
        status: status || "pendente",
        arquivos: JSON.stringify(arquivosUrls),
        createdBy: createdBy || null,
        cliente: cliente || null,
        kilometragem: kilometragem || null,
        nroProcessoErp: nroProcessoErp || null,
        rodovia: rodovia || null,
        nomeConcessionaria: nomeConcessionaria || null,
        sentido: sentido || null,
        ocupacao: ocupacao || null,
        municipioEstado: municipioEstado || null,
        ocupacaoArea: ocupacaoArea || null,
        responsavelTecnico: responsavelTecnico || null,
        faseProjeto: faseProjeto || null,
        analistaResponsavel: analistaResponsavel || null,
        memorial: memorial || null,
        dataRecebimento: dataRecebimento || null,
      },
    });

    res.status(201).json({
      ...solicitacao,
      arquivos: arquivosUrls,
    });
  } catch (error) {
    console.error("Erro ao criar solicitação:", error);
    res.status(500).json({ error: "Erro ao criar solicitação" });
  }
});

// POST /api/solicitacoes/:id/analisar - Analisar solicitação com IA
app.post(
  "/api/solicitacoes/:id/analisar",
  uploadPDFs.array("novosPDFs"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const promptCustomizado = req.body.promptCustomizado;
      const tiposProjetoBody = req.body.tiposProjetoPraComparar;

      // Buscar solicitação
      const solicitacao = await prisma.solicitacao.findUnique({
        where: { id },
      });

      if (!solicitacao) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      // Obter caminhos dos arquivos existentes
      const arquivosUrls = solicitacao.arquivos
        ? (JSON.parse(solicitacao.arquivos) as string[])
        : [];

      // Processar novos PDFs enviados (se houver)
      const novosPDFsUrls: string[] = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        novosPDFsUrls.push(
          ...req.files.map(
            (file: Express.Multer.File) => buildUploadUrl(req, file.filename),
          ),
        );

        // Atualizar lista de arquivos da solicitação com os novos PDFs
        const todosArquivos = [...arquivosUrls, ...novosPDFsUrls];
        await prisma.solicitacao.update({
          where: { id },
          data: {
            arquivos: JSON.stringify(todosArquivos),
          },
        });
      }

      // Combinar arquivos existentes com novos
      const todosArquivosUrls = [...arquivosUrls, ...novosPDFsUrls];

      // Converter URLs para caminhos locais
      const arquivosPaths = todosArquivosUrls
        .map((url) => {
          const filename = url.split("/").pop();
          return filename ? path.join(__dirname, "../uploads", filename) : null;
        })
        .filter((p): p is string => p !== null && fs.existsSync(p));

      // Obter prompt (customizado ou padrão)
      const variaveisPrompt: Record<string, string> = {
        titulo: solicitacao.titulo,
        tipoObra: solicitacao.tipoObra,
        localizacao: solicitacao.localizacao,
        descricao: solicitacao.descricao,
        cliente: solicitacao.cliente || "não informado",
        kilometragem: solicitacao.kilometragem || "não informado",
        nroProcessoErp: solicitacao.nroProcessoErp || "não informado",
        rodovia: solicitacao.rodovia || "não informado",
        nomeConcessionaria: solicitacao.nomeConcessionaria || "não informado",
        sentido: solicitacao.sentido || "não informado",
        ocupacao: solicitacao.ocupacao || "não informado",
        municipioEstado: solicitacao.municipioEstado || "não informado",
        ocupacaoArea: solicitacao.ocupacaoArea || "não informado",
        responsavelTecnico: solicitacao.responsavelTecnico || "não informado",
        faseProjeto: solicitacao.faseProjeto || "não informado",
        analistaResponsavel: solicitacao.analistaResponsavel || "não informado",
        memorial: solicitacao.memorial || "não informado",
        dataRecebimento: solicitacao.dataRecebimento || "não informado",
        arquivosInfo:
          todosArquivosUrls.length > 0
            ? `${todosArquivosUrls.length} documento(s) anexado(s) (${arquivosUrls.length} existente(s)${novosPDFsUrls.length > 0 ? ` + ${novosPDFsUrls.length} novo(s)` : ""})`
            : "Sem documentos anexados.",
      };

      const tipoObraFallback = (solicitacao.tipoObra || "").trim().toLowerCase();
      const tiposDoPayload = parseTiposProjetoPraComparar(tiposProjetoBody);
      const tiposParaComparar =
        tiposDoPayload.length > 0
          ? tiposDoPayload
          : tipoObraFallback
            ? [tipoObraFallback]
            : [];

      const normasSelecionadas = obterNormasSelecionadas(tiposParaComparar);
      const blocoNormativo = montarBlocoNormativoParaPrompt(normasSelecionadas);

      variaveisPrompt.tiposProjetoComparar =
        normasSelecionadas.tiposValidos.length > 0
          ? normasSelecionadas.tiposValidos.map((tipo) => tipo.id).join(", ")
          : "nenhum";
      variaveisPrompt.blocoNormativo = blocoNormativo;

      let promptParaUsar = promptCustomizado;
      if (!promptParaUsar) {
        const promptAtivo = obterPromptAtivo();
        promptParaUsar = processarPrompt(promptAtivo.prompt, variaveisPrompt);
      }
      promptParaUsar = comporPromptComNormas(promptParaUsar, blocoNormativo);
      promptParaUsar = normalizarPromptTexto(promptParaUsar);
      console.log(
        `📝 Prompt textual final: ${promptParaUsar.length} caracteres`,
      );

      // Atualizar status para "em_analise"
      await prisma.solicitacao.update({
        where: { id },
        data: { status: "em_analise" },
      });

      // Analisar com IA
      const relatorio = await analisarSolicitacaoComIA({
        titulo: solicitacao.titulo,
        tipoObra: solicitacao.tipoObra,
        localizacao: solicitacao.localizacao,
        descricao: solicitacao.descricao,
        cliente: solicitacao.cliente ?? undefined,
        kilometragem: solicitacao.kilometragem ?? undefined,
        nroProcessoErp: solicitacao.nroProcessoErp ?? undefined,
        rodovia: solicitacao.rodovia ?? undefined,
        nomeConcessionaria: solicitacao.nomeConcessionaria ?? undefined,
        sentido: solicitacao.sentido ?? undefined,
        ocupacao: solicitacao.ocupacao ?? undefined,
        municipioEstado: solicitacao.municipioEstado ?? undefined,
        ocupacaoArea: solicitacao.ocupacaoArea ?? undefined,
        responsavelTecnico: solicitacao.responsavelTecnico ?? undefined,
        faseProjeto: solicitacao.faseProjeto ?? undefined,
        analistaResponsavel: solicitacao.analistaResponsavel ?? undefined,
        memorial: solicitacao.memorial ?? undefined,
        dataRecebimento: solicitacao.dataRecebimento ?? undefined,
        arquivosPaths,
        promptCustomizado: promptParaUsar,
      });

      console.log(
        `\n🧾 Relatório bruto retornado pela IA antes de salvar no banco:\n${relatorio}\n`,
      );

      // Buscar solicitação atualizada para retornar
      const solicitacaoAtualizada = await prisma.solicitacao.findUnique({
        where: { id },
      });

      if (!solicitacaoAtualizada) {
        return res
          .status(404)
          .json({ error: "Solicitação não encontrada após atualização" });
      }

      // Salvar relatório no banco
      const solicitacaoFinal = await prisma.solicitacao.update({
        where: { id },
        data: {
          relatorioIA: relatorio,
          analisadoPorIA: true,
          analisadoEm: new Date(),
          status: "em_analise", // Mantém em análise para revisão manual
        },
      });

      res.json({
        ...solicitacaoFinal,
        arquivos: solicitacaoFinal.arquivos
          ? JSON.parse(solicitacaoFinal.arquivos)
          : [],
      });
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.error("Erro ao analisar solicitação:", errMsg);
      console.error("Stack:", error?.stack);

      // Atualizar status de volta para pendente em caso de erro
      try {
        await prisma.solicitacao.update({
          where: { id: req.params.id },
          data: { status: "pendente" },
        });
      } catch (updateError) {
        console.error("Erro ao atualizar status:", updateError);
      }

      res.status(500).json({
        error: "Erro ao analisar solicitação",
        message: errMsg,
      });
    }
  },
);

// PUT /api/solicitacoes/:id - Atualizar solicitação
app.put("/api/solicitacoes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, tipoObra, localizacao, descricao, status } = req.body;

    const solicitacao = await prisma.solicitacao.update({
      where: { id },
      data: {
        ...(titulo && { titulo }),
        ...(tipoObra && { tipoObra }),
        ...(localizacao && { localizacao }),
        ...(descricao && { descricao }),
        ...(status && { status }),
      },
    });

    res.json({
      ...solicitacao,
      arquivos: solicitacao.arquivos ? JSON.parse(solicitacao.arquivos) : [],
      relatorioIA: solicitacao.relatorioIA || null,
    });
  } catch (error) {
    console.error("Erro ao atualizar solicitação:", error);
    res.status(500).json({ error: "Erro ao atualizar solicitação" });
  }
});

// GET /api/prompts - Listar todos os prompts
app.get("/api/prompts", (req, res) => {
  try {
    const prompts = carregarPrompts();
    res.json(prompts);
  } catch (error) {
    console.error("Erro ao listar prompts:", error);
    res.status(500).json({ error: "Erro ao listar prompts" });
  }
});

// GET /api/prompts/:id - Obter prompt por ID
app.get("/api/prompts/:id", (req, res) => {
  try {
    const prompt = obterPromptPorId(req.params.id);

    if (!prompt) {
      return res.status(404).json({ error: "Prompt não encontrado" });
    }

    res.json(prompt);
  } catch (error) {
    console.error("Erro ao buscar prompt:", error);
    res.status(500).json({ error: "Erro ao buscar prompt" });
  }
});

// POST /api/prompts - Criar novo prompt
app.post("/api/prompts", express.json(), (req, res) => {
  try {
    const prompts = carregarPrompts();

    const novoPrompt = {
      id: req.body.id || `prompt-${Date.now()}`,
      nome: req.body.nome,
      descricao: req.body.descricao,
      prompt: req.body.prompt,
      ativo: req.body.ativo || false,
    };

    prompts.push(novoPrompt);
    salvarPrompts(prompts);

    res.status(201).json(novoPrompt);
  } catch (error) {
    console.error("Erro ao criar prompt:", error);
    res.status(500).json({ error: "Erro ao criar prompt" });
  }
});

// PUT /api/prompts/:id - Atualizar prompt
app.put("/api/prompts/:id", express.json(), (req, res) => {
  try {
    const prompts = carregarPrompts();

    const index = prompts.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Prompt não encontrado" });
    }

    prompts[index] = {
      ...prompts[index],
      ...req.body,
      id: req.params.id, // Garantir que o ID não mude
    };

    salvarPrompts(prompts);
    res.json(prompts[index]);
  } catch (error) {
    console.error("Erro ao atualizar prompt:", error);
    res.status(500).json({ error: "Erro ao atualizar prompt" });
  }
});

// GET /api/solicitacoes/:id/download - Baixar anexos da solicitação em ZIP
app.get("/api/solicitacoes/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      select: {
        id: true,
        arquivos: true,
      },
    });

    if (!solicitacao) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    const arquivosUrls = solicitacao.arquivos
      ? (JSON.parse(solicitacao.arquivos) as string[])
      : [];

    if (arquivosUrls.length === 0) {
      return res.status(404).json({ error: "Nenhum anexo encontrado" });
    }

    const arquivosValidos = arquivosUrls
      .map((fileUrl, index) => {
        try {
          const pathname =
            fileUrl.startsWith("http://") || fileUrl.startsWith("https://")
              ? new URL(fileUrl).pathname
              : fileUrl;
          const rawName = pathname.split("/").pop();
          const safeFilename = rawName ? path.basename(rawName) : null;
          if (!safeFilename) return null;

          const localPath = path.join(__dirname, "../uploads", safeFilename);
          if (!fs.existsSync(localPath)) {
            console.warn(`Arquivo não encontrado para download: ${localPath}`);
            return null;
          }

          return {
            localPath,
            archiveName: `${String(index + 1).padStart(2, "0")}-${safeFilename}`,
          };
        } catch (error) {
          console.warn(`Erro ao processar URL de arquivo: ${fileUrl}`);
          return null;
        }
      })
      .filter((item): item is { localPath: string; archiveName: string } => item !== null);

    if (arquivosValidos.length === 0) {
      return res
        .status(404)
        .json({ error: "Nenhum anexo disponível para download" });
    }

    const zipFilename = `solicitacao-${solicitacao.id}-anexos.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${zipFilename}\"`,
    );

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.on("error", (error: Error) => {
      console.error("Erro ao gerar ZIP de anexos:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao gerar arquivo ZIP" });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    arquivosValidos.forEach((arquivo) => {
      archive.file(arquivo.localPath, { name: arquivo.archiveName });
    });

    await archive.finalize();
  } catch (error) {
    console.error("Erro ao baixar anexos:", error);
    res.status(500).json({ error: "Erro ao baixar anexos" });
  }
});

// DELETE /api/solicitacoes/:id - Deletar solicitação
app.delete("/api/solicitacoes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar solicitação para deletar arquivos
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
    });

    if (solicitacao && solicitacao.arquivos) {
      const arquivosUrls = JSON.parse(solicitacao.arquivos) as string[];
      // Deletar arquivos do sistema de arquivos
      arquivosUrls.forEach((url) => {
        const filename = url.split("/").pop();
        if (filename) {
          const filePath = path.join(__dirname, "../uploads", filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });
    }

    await prisma.solicitacao.delete({
      where: { id },
    });

    res.json({ message: "Solicitação deletada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar solicitação:", error);
    res.status(500).json({ error: "Erro ao deletar solicitação" });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
