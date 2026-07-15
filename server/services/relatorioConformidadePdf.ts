import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type StatusConformidadeItem =
  | "conforme"
  | "parcialmente_conforme"
  | "nao_conforme"
  | "exige_atencao"
  | "nao_avaliado";

export type CriticidadeNivel =
  | "baixa"
  | "media"
  | "alta"
  | "critica"
  | "nao_avaliada";

export interface RelatorioPdfInput {
  solicitacaoId: string;
  identificadorRelatorio: string;
  statusGeral: StatusConformidadeItem;
  analisadoEm: string;
  metadados: {
    tituloRelatorio: string;
    nomeProjeto: string;
    numeroContrato: string;
    nomeConcessionaria: string;
    trechoRodovia: string;
    responsavel: string;
    observacoes: string;
    dataReferencia: string;
    classificacaoConfidencialidade: string;
    logoConcessionariaDataUrl?: string | null;
  };
  indicadores: {
    totalAnalisados: number;
    conformes: number;
    parcialmenteConformes: number;
    naoConformes: number;
    exigemAtencao: number;
    naoAvaliados: number;
    percentualConformidade: number;
    porCriticidade: Record<CriticidadeNivel, number>;
  };
  resumoExecutivo: {
    objetivo: string;
    escopo: string;
    principaisConclusoes: string[];
    principaisRiscos: string[];
    recomendacoesPrioritarias: string[];
  };
  itens: Array<{
    codigo: string;
    titulo: string;
    descricao: string;
    status: StatusConformidadeItem;
    criticidade: CriticidadeNivel;
    resultadoAnalise: string;
    justificativaIa: string;
    evidencias: string;
    recomendacao: string;
    referenciaNormativa: string;
    observacoes: string;
  }>;
  planoAcao: Array<{
    itemCodigo: string;
    acaoRecomendada: string;
    prioridade: CriticidadeNivel;
    responsavel: string;
    prazo: string;
    statusTratamento: string;
    observacoes: string;
  }>;
  geradoPorNome?: string | null;
}

const COLORS = {
  primary: "#0f2f73",
  primaryLight: "#2357c4",
  accent: "#f1b726",
  text: "#14233d",
  muted: "#5d708e",
  border: "#d5e3f5",
  success: "#1e9f63",
  warning: "#d18807",
  danger: "#db3648",
  neutral: "#6b7280",
  white: "#ffffff",
  soft: "#f2f8ff",
};

const STATUS_LABELS: Record<StatusConformidadeItem, string> = {
  conforme: "Conforme",
  parcialmente_conforme: "Parcialmente conforme",
  nao_conforme: "Não conforme",
  exige_atencao: "Exige atenção",
  nao_avaliado: "Não avaliado",
};

const STATUS_COLORS: Record<StatusConformidadeItem, string> = {
  conforme: COLORS.success,
  parcialmente_conforme: COLORS.warning,
  nao_conforme: COLORS.danger,
  exige_atencao: COLORS.warning,
  nao_avaliado: COLORS.neutral,
};

const CRIT_LABELS: Record<CriticidadeNivel, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
  nao_avaliada: "N/A",
};

function sanitize(value: unknown, max = 4000): string {
  if (value == null) return "";
  let text = String(value);
  text = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<\/?[^>]+>/g, "");
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  text = text.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function slugify(value: string, fallback = "na"): string {
  const slug = sanitize(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

export function buildSafePdfFileName(input: RelatorioPdfInput, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const concessionaria = slugify(input.metadados.nomeConcessionaria, "concessionaria");
  const projeto = slugify(input.metadados.nomeProjeto, "projeto");
  return `relatorio-conformidade-${concessionaria}-${projeto}-${y}-${m}-${d}.pdf`;
}

function parseDataUrl(dataUrl?: string | null): Buffer | null {
  if (!dataUrl?.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i);
  if (!match) return null;
  try {
    const buf = Buffer.from(match[2], "base64");
    // Limite ~2MB
    if (buf.length > 2 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

function findBaseInfraLogo(): Buffer | null {
  const candidates = [
    path.join(__dirname, "../../public/logo420.png"),
    path.join(process.cwd(), "public/logo420.png"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }
  return null;
}

function formatDateBr(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidencialidadeLabel(value: string): string {
  const map: Record<string, string> = {
    publico: "Público",
    interno: "Uso interno",
    confidencial: "Confidencial",
    restrito: "Restrito",
  };
  return map[value] || sanitize(value, 80) || "Confidencial";
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - 56;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  input: RelatorioPdfInput,
  pageNumber: number,
  geradoEm: string,
) {
  const { width, height } = doc.page;
  const conf = confidencialidadeLabel(input.metadados.classificacaoConfidencialidade);
  doc.save();
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(40, height - 42)
    .lineTo(width - 40, height - 42)
    .stroke();
  doc
    .fillColor(COLORS.muted)
    .fontSize(7)
    .font("Helvetica")
    .text(
      `BaseInfra — Relatório de Análise de Conformidade | ${input.identificadorRelatorio} | Emitido em ${geradoEm} | ${conf}`,
      40,
      height - 34,
      { width: width - 120, align: "left" },
    );
  doc.text(`Página ${pageNumber}`, width - 90, height - 34, {
    width: 50,
    align: "right",
  });
  doc.restore();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 36);
  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(title, { continued: false });
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - 40, doc.y)
    .strokeColor(COLORS.accent)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor(COLORS.text).font("Helvetica").fontSize(9);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    ensureSpace(doc, 28);
    doc
      .fillColor(COLORS.text)
      .font("Helvetica")
      .fontSize(9)
      .text(`• ${sanitize(item, 600)}`, { width: doc.page.width - 80 });
    doc.moveDown(0.25);
  }
}

function drawIndicatorBars(doc: PDFKit.PDFDocument, input: RelatorioPdfInput) {
  const total = Math.max(input.indicadores.totalAnalisados, 1);
  const rows: Array<{ label: string; value: number; color: string }> = [
    { label: "Conformes", value: input.indicadores.conformes, color: COLORS.success },
    {
      label: "Parcialmente conformes",
      value: input.indicadores.parcialmenteConformes,
      color: COLORS.warning,
    },
    { label: "Não conformes", value: input.indicadores.naoConformes, color: COLORS.danger },
    {
      label: "Exigem atenção",
      value: input.indicadores.exigemAtencao,
      color: COLORS.warning,
    },
    {
      label: "Não avaliados",
      value: input.indicadores.naoAvaliados,
      color: COLORS.neutral,
    },
  ];

  const barMaxWidth = doc.page.width - 220;
  for (const row of rows) {
    ensureSpace(doc, 22);
    const y = doc.y;
    doc.fillColor(COLORS.text).fontSize(8).font("Helvetica").text(row.label, 40, y, {
      width: 120,
    });
    doc
      .fillColor(COLORS.soft)
      .roundedRect(170, y + 2, barMaxWidth, 10, 3)
      .fill();
    const w = Math.max(2, (row.value / total) * barMaxWidth);
    doc
      .fillColor(row.color)
      .roundedRect(170, y + 2, w, 10, 3)
      .fill();
    doc
      .fillColor(COLORS.muted)
      .text(String(row.value), 170 + barMaxWidth + 8, y, { width: 30 });
    doc.y = y + 18;
  }
}

function drawTableHeader(doc: PDFKit.PDFDocument, cols: Array<{ label: string; x: number; w: number }>) {
  ensureSpace(doc, 24);
  const y = doc.y;
  doc.fillColor(COLORS.primary).rect(40, y, doc.page.width - 80, 18).fill();
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(7);
  for (const col of cols) {
    doc.text(col.label, col.x, y + 5, { width: col.w });
  }
  doc.y = y + 22;
  doc.fillColor(COLORS.text).font("Helvetica").fontSize(8);
}

/**
 * Gera PDF A4 profissional do relatório de conformidade.
 */
export async function generateRelatorioConformidadePdf(
  input: RelatorioPdfInput,
): Promise<{ buffer: Buffer; fileName: string; geradoEm: string }> {
  const geradoEm = formatDateBr(new Date().toISOString());
  const fileName = buildSafePdfFileName(input);
  const baseLogo = findBaseInfraLogo();
  const concLogo = parseDataUrl(input.metadados.logoConcessionariaDataUrl);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 56, left: 40, right: 40 },
    info: {
      Title: sanitize(input.metadados.tituloRelatorio, 120),
      Author: "BaseInfra",
      Subject: `Análise de Conformidade — ${sanitize(input.metadados.nomeProjeto, 120)}`,
      Keywords: "conformidade, BaseInfra, relatório",
    },
    autoFirstPage: true,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ===== CAPA =====
  doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
  doc.rect(0, 8, doc.page.width, 4).fill(COLORS.accent);

  if (baseLogo) {
    try {
      doc.image(baseLogo, 40, 40, { fit: [160, 48] });
    } catch {
      doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(16).text("BaseInfra", 40, 50);
    }
  } else {
    doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(16).text("BaseInfra", 40, 50);
  }

  // Logo concessionária (sem contorno, maior)
  const logoRightX = doc.page.width - 40 - 170;
  if (concLogo) {
    try {
      doc.image(concLogo, logoRightX, 36, { fit: [170, 56], align: "right" });
    } catch {
      doc
        .fillColor(COLORS.muted)
        .fontSize(10)
        .text(
          sanitize(input.metadados.nomeConcessionaria, 40) || "Concessionária",
          logoRightX,
          56,
          { width: 170, align: "right" },
        );
    }
  } else {
    doc
      .fillColor(COLORS.muted)
      .fontSize(10)
      .text(
        sanitize(input.metadados.nomeConcessionaria, 40) || "Logo da concessionária",
        logoRightX,
        56,
        { width: 170, align: "right" },
      );
  }

  doc.moveDown(6);
  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(sanitize(input.metadados.tituloRelatorio, 120), 40, 160, {
      width: doc.page.width - 80,
      align: "center",
    });

  doc.moveDown(1.5);
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(12)
    .text(sanitize(input.metadados.nomeProjeto, 200), { align: "center" });

  doc.moveDown(0.5);
  doc
    .fillColor(COLORS.muted)
    .fontSize(10)
    .text(sanitize(input.metadados.nomeConcessionaria, 150) || "Concessionária não informada", {
      align: "center",
    });

  if (input.metadados.trechoRodovia) {
    doc.moveDown(0.3);
    doc.text(sanitize(input.metadados.trechoRodovia, 200), { align: "center" });
  }

  const statusColor = STATUS_COLORS[input.statusGeral] || COLORS.neutral;
  doc.moveDown(2);
  const badgeW = 220;
  const badgeX = (doc.page.width - badgeW) / 2;
  const badgeY = doc.y;
  doc
    .roundedRect(badgeX, badgeY, badgeW, 36, 8)
    .fill(statusColor);
  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(STATUS_LABELS[input.statusGeral], badgeX, badgeY + 11, {
      width: badgeW,
      align: "center",
    });

  doc.fillColor(COLORS.text).font("Helvetica").fontSize(10);
  doc.y = badgeY + 56;
  doc.text(`Índice de conformidade: ${input.indicadores.percentualConformidade}%`, {
    align: "center",
  });
  doc.moveDown(0.4);
  doc.text(`Data da análise: ${formatDateBr(input.analisadoEm)}`, { align: "center" });
  doc.moveDown(0.3);
  doc.text(`Identificador: ${input.identificadorRelatorio}`, { align: "center" });
  if (input.metadados.numeroContrato) {
    doc.moveDown(0.3);
    doc.text(`Contrato / processo: ${sanitize(input.metadados.numeroContrato, 100)}`, {
      align: "center",
    });
  }
  if (input.metadados.responsavel) {
    doc.moveDown(0.3);
    doc.text(`Responsável: ${sanitize(input.metadados.responsavel, 120)}`, { align: "center" });
  }

  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .text(
      `${confidencialidadeLabel(input.metadados.classificacaoConfidencialidade)} — BaseInfra Projetos e Consultoria`,
      40,
      doc.page.height - 80,
      { width: doc.page.width - 80, align: "center" },
    );

  // ===== RESUMO EXECUTIVO =====
  doc.addPage();
  sectionTitle(doc, "1. Resumo executivo");
  doc.font("Helvetica-Bold").text("Objetivo");
  doc.font("Helvetica").text(sanitize(input.resumoExecutivo.objetivo, 800));
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text("Escopo avaliado");
  doc.font("Helvetica").text(sanitize(input.resumoExecutivo.escopo, 800));
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .text(`Percentual geral de conformidade: ${input.indicadores.percentualConformidade}%`);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").text("Principais conclusões");
  bulletList(doc, input.resumoExecutivo.principaisConclusoes);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").text("Principais riscos identificados");
  bulletList(doc, input.resumoExecutivo.principaisRiscos);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").text("Recomendações prioritárias");
  bulletList(doc, input.resumoExecutivo.recomendacoesPrioritarias);

  if (input.metadados.observacoes) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Observações");
    doc.font("Helvetica").text(sanitize(input.metadados.observacoes, 1500));
  }

  // ===== INDICADORES =====
  doc.addPage();
  sectionTitle(doc, "2. Indicadores");
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(`Total de itens analisados: ${input.indicadores.totalAnalisados}`);
  doc.moveDown(0.8);
  drawIndicatorBars(doc, input);

  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("Distribuição por criticidade");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);
  for (const key of Object.keys(input.indicadores.porCriticidade) as CriticidadeNivel[]) {
    const value = input.indicadores.porCriticidade[key] ?? 0;
    doc.text(`${CRIT_LABELS[key]}: ${value}`);
  }

  // ===== DETALHAMENTO =====
  doc.addPage();
  sectionTitle(doc, "3. Detalhamento da análise");

  const detailCols = [
    { label: "Código", x: 44, w: 70 },
    { label: "Título", x: 118, w: 160 },
    { label: "Status", x: 282, w: 80 },
    { label: "Criticidade", x: 366, w: 70 },
    { label: "Resultado", x: 440, w: 110 },
  ];

  drawTableHeader(doc, detailCols);

  for (const item of input.itens) {
    ensureSpace(doc, 70);
    if (doc.y < 70) {
      // nova página — repetir cabeçalho
      drawTableHeader(doc, detailCols);
    }

    const startY = doc.y;
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(8);
    doc.text(sanitize(item.codigo, 40), 44, startY, { width: 70 });
    doc.font("Helvetica").text(sanitize(item.titulo, 120), 118, startY, { width: 160 });
    doc.fillColor(STATUS_COLORS[item.status]).text(STATUS_LABELS[item.status], 282, startY, {
      width: 80,
    });
    doc.fillColor(COLORS.text).text(CRIT_LABELS[item.criticidade], 366, startY, { width: 70 });
    doc.text(sanitize(item.resultadoAnalise, 80), 440, startY, { width: 110 });

    doc.y = Math.max(doc.y, startY + 14);
    doc.fillColor(COLORS.muted).fontSize(7);
    doc.text(`Evidências: ${sanitize(item.evidencias, 500)}`, 44, doc.y, {
      width: doc.page.width - 84,
    });
    doc.text(`Justificativa IA: ${sanitize(item.justificativaIa, 500)}`, 44, doc.y, {
      width: doc.page.width - 84,
    });
    doc.text(`Recomendação: ${sanitize(item.recomendacao, 400)}`, 44, doc.y, {
      width: doc.page.width - 84,
    });
    doc.text(`Referência: ${sanitize(item.referenciaNormativa, 300)}`, 44, doc.y, {
      width: doc.page.width - 84,
    });
    if (item.observacoes) {
      doc.text(`Observações: ${sanitize(item.observacoes, 300)}`, 44, doc.y, {
        width: doc.page.width - 84,
      });
    }
    doc
      .strokeColor(COLORS.border)
      .moveTo(40, doc.y + 4)
      .lineTo(doc.page.width - 40, doc.y + 4)
      .stroke();
    doc.moveDown(0.6);
  }

  // ===== PLANO DE AÇÃO =====
  doc.addPage();
  sectionTitle(doc, "4. Plano de ação");

  if (input.planoAcao.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.text)
      .text("Nenhuma ação pendente — não há não conformidades ou itens que exijam atenção.");
  } else {
    const actionCols = [
      { label: "Item", x: 44, w: 60 },
      { label: "Ação recomendada", x: 108, w: 200 },
      { label: "Prioridade", x: 314, w: 60 },
      { label: "Responsável", x: 378, w: 80 },
      { label: "Status", x: 462, w: 70 },
    ];
    drawTableHeader(doc, actionCols);

    for (const acao of input.planoAcao) {
      ensureSpace(doc, 40);
      if (doc.y < 70) drawTableHeader(doc, actionCols);
      const y = doc.y;
      doc.fillColor(COLORS.text).font("Helvetica").fontSize(7);
      doc.text(sanitize(acao.itemCodigo, 40), 44, y, { width: 60 });
      doc.text(sanitize(acao.acaoRecomendada, 300), 108, y, { width: 200 });
      doc.text(CRIT_LABELS[acao.prioridade] || acao.prioridade, 314, y, { width: 60 });
      doc.text(sanitize(acao.responsavel, 80) || "—", 378, y, { width: 80 });
      doc.text(sanitize(acao.statusTratamento, 40) || "pendente", 462, y, { width: 70 });
      doc.y = Math.max(doc.y, y + 12);
      if (acao.prazo || acao.observacoes) {
        doc
          .fillColor(COLORS.muted)
          .text(
            `Prazo: ${sanitize(acao.prazo, 40) || "—"} | Obs.: ${sanitize(acao.observacoes, 200) || "—"}`,
            44,
            doc.y,
            { width: doc.page.width - 84 },
          );
      }
      doc.moveDown(0.5);
    }
  }

  // Numeração de páginas
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    drawFooter(doc, input, i + 1, geradoEm);
  }

  doc.end();
  const buffer = await done;
  return { buffer, fileName, geradoEm };
}

export function createReportId(): string {
  return randomUUID();
}
