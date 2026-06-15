import * as fs from "fs";
import * as path from "path";
import normasCatalogo from "../config/normas.json";

export type TipoRelatorio = "pit" | "obra_per" | "obra_nao_per";

export interface FonteNormativa {
  id: string;
  titulo: string;
  orgao: string;
  ano: number;
  pdf: string;
  descricao: string;
  requerPdf?: boolean;
}

export interface RequisitoNormativo {
  id: string;
  descricao: string;
  categoria?: string;
}

export interface TipoProjetoConfig {
  nome: string;
  fontes: string[];
  maxPaginas: number;
  requisitos: RequisitoNormativo[];
}

const NORMAS_PDF_DIR = path.join(__dirname, "..", "config", "normas-pdf");

export function getTipoProjetoConfig(
  tipo: TipoRelatorio,
): TipoProjetoConfig | null {
  const config =
    normasCatalogo.tiposProjeto[tipo as keyof typeof normasCatalogo.tiposProjeto];
  return config ?? null;
}

export function getFontesParaTipo(tipo: TipoRelatorio): FonteNormativa[] {
  const config = getTipoProjetoConfig(tipo);
  if (!config) return [];

  return normasCatalogo.fontes.filter((f) =>
    config.fontes.includes(f.id),
  ) as FonteNormativa[];
}

export function getRequisitosParaConcessionaria(
  concessionariaId?: string | null,
): RequisitoNormativo[] {
  if (concessionariaId !== "eco101") return [];

  const cfg =
    normasCatalogo.concessionarias?.eco101 as
      | { requisitos?: RequisitoNormativo[] }
      | undefined;
  return cfg?.requisitos ?? [];
}

export function getRequisitosParaTipo(
  tipo: TipoRelatorio,
  concessionariaId?: string | null,
): RequisitoNormativo[] {
  const eco101 = getRequisitosParaConcessionaria(concessionariaId);
  if (eco101.length > 0) return eco101;

  const config = getTipoProjetoConfig(tipo);
  return config?.requisitos ?? [];
}

export function getMaxPaginas(tipo: TipoRelatorio): number {
  const config = getTipoProjetoConfig(tipo);
  return config?.maxPaginas ?? 10;
}

export function carregarNormaPDF(normaId: string): Buffer | null {
  const fonte = normasCatalogo.fontes.find(
    (f) => f.id === normaId,
  ) as FonteNormativa | undefined;
  if (!fonte) {
    console.warn(`Norma não encontrada no catálogo: ${normaId}`);
    return null;
  }

  if (fonte.requerPdf === false) {
    return null;
  }

  const pdfPath = path.join(NORMAS_PDF_DIR, fonte.pdf);
  if (!fs.existsSync(pdfPath)) {
    console.warn(`PDF normativo ausente: ${pdfPath}`);
    return null;
  }

  return fs.readFileSync(pdfPath);
}

export function carregarNormasPDFParaTipo(
  tipo: TipoRelatorio,
): Array<{ fonte: FonteNormativa; buffer: Buffer }> {
  const fontes = getFontesParaTipo(tipo);
  const resultados: Array<{ fonte: FonteNormativa; buffer: Buffer }> = [];

  for (const fonte of fontes) {
    const buffer = carregarNormaPDF(fonte.id);
    if (buffer) {
      resultados.push({ fonte, buffer });
    }
  }

  return resultados;
}

export function listarRequisitosFormatados(
  tipo: TipoRelatorio,
  concessionariaId?: string | null,
): string {
  const requisitos = getRequisitosParaTipo(tipo, concessionariaId);
  if (requisitos.length === 0) return "Nenhum requisito configurado.";

  return requisitos
    .map((r) => {
      const cat = r.categoria ? ` [${r.categoria}]` : "";
      return `- ${r.id}: ${r.descricao}${cat}`;
    })
    .join("\n");
}
