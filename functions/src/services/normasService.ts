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
}

export interface RequisitoNormativo {
  id: string;
  descricao: string;
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

export function getRequisitosParaTipo(
  tipo: TipoRelatorio,
): RequisitoNormativo[] {
  const config = getTipoProjetoConfig(tipo);
  return config?.requisitos ?? [];
}

export function getMaxPaginas(tipo: TipoRelatorio): number {
  const config = getTipoProjetoConfig(tipo);
  return config?.maxPaginas ?? 10;
}

export function carregarNormaPDF(normaId: string): Buffer {
  const fonte = normasCatalogo.fontes.find(
    (f) => f.id === normaId,
  ) as FonteNormativa | undefined;
  if (!fonte) {
    throw new Error(`Norma não encontrada no catálogo: ${normaId}`);
  }

  const pdfPath = path.join(NORMAS_PDF_DIR, fonte.pdf);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF da norma não encontrado: ${pdfPath}`);
  }

  return fs.readFileSync(pdfPath);
}

export function carregarNormasPDFParaTipo(
  tipo: TipoRelatorio,
): Array<{ fonte: FonteNormativa; buffer: Buffer }> {
  const fontes = getFontesParaTipo(tipo);
  return fontes.map((fonte) => ({
    fonte,
    buffer: carregarNormaPDF(fonte.id),
  }));
}

export function listarRequisitosFormatados(tipo: TipoRelatorio): string {
  const requisitos = getRequisitosParaTipo(tipo);
  if (requisitos.length === 0) return "Nenhum requisito configurado.";

  return requisitos
    .map((r) => `- ${r.id}: ${r.descricao}`)
    .join("\n");
}
