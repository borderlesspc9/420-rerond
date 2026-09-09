import { getFirestore } from "firebase-admin/firestore";

export type GoldenCaseValidacaoStatus =
  | "rascunho"
  | "pendente"
  | "aprovado"
  | "rejeitado";

export type GoldenCaseParFirestore = {
  id: string;
  regraOuItem?: string | null;
  original: string;
  correto: string;
  justificativa: string;
};

export type GoldenCaseFirestore = {
  id: string;
  codigo: string;
  titulo: string;
  tipoAnaliseId: string;
  organizacaoId?: string | null;
  erroIa?: string | null;
  analiseCorreta: string;
  pares: GoldenCaseParFirestore[];
  status: GoldenCaseValidacaoStatus;
  ativo: boolean;
  updatedAtMs: number;
  createdAtMs: number;
};

const COLLECTION =
  process.env.FIRESTORE_GOLDEN_CASES_COLLECTION?.trim() || "goldenCases";

const DEFAULT_MAX_ITEMS = 3;
const DEFAULT_MAX_CHARS_FIELD = 500;
const DEFAULT_MAX_BLOCK_CHARS = 8000;

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value) ?? 0;
  }
  return 0;
}

function normalizePares(
  raw: unknown,
  fallback?: { erroIa?: string | null; analiseCorreta?: string },
): GoldenCaseParFirestore[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const out: GoldenCaseParFirestore[] = [];
    raw.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const obj = item as Record<string, unknown>;
      const original = String(obj.original ?? "").trim();
      const correto = String(obj.correto ?? "").trim();
      const justificativa = String(obj.justificativa ?? "").trim();
      if (!original || !correto || !justificativa) return;
      out.push({
        id: String(obj.id ?? `par-${index + 1}`),
        regraOuItem: obj.regraOuItem ? String(obj.regraOuItem).trim() : null,
        original,
        correto,
        justificativa,
      });
    });
    return out;
  }

  const erro = fallback?.erroIa?.trim();
  const correta = fallback?.analiseCorreta?.trim();
  if (erro && correta) {
    return [
      {
        id: "par-legado",
        original: erro,
        correto: correta,
        justificativa: "Par derivado do registro legado.",
      },
    ];
  }
  return [];
}

function parseDoc(
  id: string,
  raw: Record<string, unknown>,
): GoldenCaseFirestore | null {
  // Sem status explícito: legado só entra se ativo (compat); docs novos sempre gravam status.
  const hasStatusField = Object.prototype.hasOwnProperty.call(raw, "status");
  const statusRaw = hasStatusField
    ? String(raw.status ?? "").trim()
    : "aprovado";
  const status = (
    ["rascunho", "pendente", "aprovado", "rejeitado"].includes(statusRaw)
      ? statusRaw
      : null
  ) as GoldenCaseValidacaoStatus | null;

  if (!status || status !== "aprovado") return null;
  if (raw.ativo === false) return null;

  const tipoAnaliseId =
    typeof raw.tipoAnaliseId === "string" ? raw.tipoAnaliseId.trim() : "";
  if (!tipoAnaliseId) return null;

  const codigo = String(raw.codigo ?? "").trim();
  const titulo = String(raw.titulo ?? "").trim();
  const analiseCorreta = String(raw.analiseCorreta ?? "").trim();
  const erroIa = raw.erroIa ? String(raw.erroIa) : null;
  const pares = normalizePares(raw.pares, { erroIa, analiseCorreta });
  if (!analiseCorreta && pares.length === 0) return null;

  return {
    id,
    codigo: codigo || id,
    titulo: titulo || codigo || id,
    tipoAnaliseId,
    organizacaoId:
      typeof raw.organizacaoId === "string" && raw.organizacaoId.trim()
        ? raw.organizacaoId.trim()
        : null,
    erroIa,
    analiseCorreta: analiseCorreta || pares.map((p) => p.correto).join("\n"),
    pares,
    status,
    ativo: raw.ativo !== false,
    updatedAtMs: toMs(raw.updatedAt) || toMs(raw.createdAt),
    createdAtMs: toMs(raw.createdAt),
  };
}

export async function listGoldenCasesAprovadosParaAnalise(params: {
  tipoAnaliseId: string;
  organizacaoId?: string | null;
  maxItems?: number;
}): Promise<GoldenCaseFirestore[]> {
  const tipoId = params.tipoAnaliseId.trim();
  if (!tipoId) return [];

  const maxItems = Math.max(1, Math.min(params.maxItems ?? DEFAULT_MAX_ITEMS, 10));
  const orgId = params.organizacaoId?.trim() || null;

  try {
    const db = getFirestore();
    const snap = await db.collection(COLLECTION).limit(80).get();

    return snap.docs
      .map((doc) => parseDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter((item): item is GoldenCaseFirestore => Boolean(item))
      .filter((item) => item.tipoAnaliseId === tipoId)
      .filter((item) => {
        if (!item.organizacaoId) return true;
        if (!orgId) return false;
        return item.organizacaoId === orgId;
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs || b.createdAtMs - a.createdAtMs)
      .slice(0, maxItems);
  } catch (err) {
    console.warn("Falha ao carregar goldenCases aprovados:", err);
    return [];
  }
}

export function buildGoldenCasesPromptBlock(
  items: GoldenCaseFirestore[],
  options?: { maxCharsPerField?: number; maxBlockChars?: number },
): string {
  if (!items.length) return "";

  const maxField = options?.maxCharsPerField ?? DEFAULT_MAX_CHARS_FIELD;
  const maxBlock = options?.maxBlockChars ?? DEFAULT_MAX_BLOCK_CHARS;

  const linhas: string[] = [
    "═══════════════════════════════════════",
    "CASOS MODELO (GOLDEN CASES — MESMO TIPO)",
    "═══════════════════════════════════════",
    "Use como referência de qualidade para ESTE tipo de análise.",
    "NÃO copie fatos dos documentos do caso modelo como se fossem da solicitação atual.",
    "Em conflito com normas/PDFs anexados da solicitação, prevalecem normas + evidência documental.",
    "Casos rascunho/pendente/rejeitado/inativos NÃO devem ser considerados (já filtrados).",
    "",
  ];

  items.forEach((item, index) => {
    linhas.push(
      `${index + 1}) [${item.codigo}] ${truncate(item.titulo, 200)}`,
      `   Resumo análise correta: ${truncate(item.analiseCorreta || "(não informado)", 600)}`,
    );
    if (item.erroIa?.trim()) {
      linhas.push(`   Erro típico da IA (evitar): ${truncate(item.erroIa, 400)}`);
    }
    item.pares.forEach((par, pi) => {
      linhas.push(
        `   Par ${pi + 1}${par.regraOuItem ? ` (${truncate(par.regraOuItem, 80)})` : ""}:`,
        `     - Errado: ${truncate(par.original, maxField)}`,
        `     - Correto: ${truncate(par.correto, maxField)}`,
        `     - Justificativa: ${truncate(par.justificativa, maxField)}`,
      );
    });
    linhas.push("");
  });

  let block = linhas.join("\n").trim();
  if (block.length > maxBlock) {
    block = `${block.slice(0, maxBlock - 1)}…`;
  }
  return block;
}
