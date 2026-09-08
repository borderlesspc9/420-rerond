import { getFirestore } from "firebase-admin/firestore";

export type FeedbackValidacaoStatus =
  | "rascunho"
  | "pendente"
  | "aprovado"
  | "rejeitado";

export type FeedbackAprendizadoFirestore = {
  id: string;
  tipoAnaliseId?: string | null;
  organizacaoId?: string | null;
  regraOuItem: string;
  original: string;
  correcao: string;
  justificativa: string;
  status: FeedbackValidacaoStatus;
  updatedAtMs: number;
  createdAtMs: number;
};

const COLLECTION =
  process.env.FIRESTORE_FEEDBACKS_COLLECTION?.trim() || "feedbacksAprendizado";

const DEFAULT_MAX_ITEMS = 8;
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

function parseDoc(
  id: string,
  raw: Record<string, unknown>,
): FeedbackAprendizadoFirestore | null {
  const status = String(raw.status ?? "") as FeedbackValidacaoStatus;
  if (status !== "aprovado") return null;

  const tipoAnaliseId =
    typeof raw.tipoAnaliseId === "string" ? raw.tipoAnaliseId.trim() : "";
  if (!tipoAnaliseId) return null;

  const regraOuItem = String(raw.regraOuItem ?? "").trim();
  const original = String(raw.original ?? "").trim();
  const correcao = String(raw.correcao ?? "").trim();
  const justificativa = String(raw.justificativa ?? "").trim();
  if (!regraOuItem || !original || !correcao || !justificativa) return null;

  return {
    id,
    tipoAnaliseId,
    organizacaoId:
      typeof raw.organizacaoId === "string" && raw.organizacaoId.trim()
        ? raw.organizacaoId.trim()
        : null,
    regraOuItem,
    original,
    correcao,
    justificativa,
    status,
    updatedAtMs: toMs(raw.updatedAt) || toMs(raw.createdAt),
    createdAtMs: toMs(raw.createdAt),
  };
}

/**
 * Carrega feedbacks aprovados para injeção no prompt.
 * Salvaguardas: só aprovado; exige tipoAnaliseId; escopo org (null = genérico do tipo);
 * limita quantidade e tamanho.
 */
export async function listFeedbacksAprovadosParaAnalise(params: {
  tipoAnaliseId: string;
  /** Mapeia para Feedback.organizacaoId (hoje = concessionariaId). */
  organizacaoId?: string | null;
  maxItems?: number;
}): Promise<FeedbackAprendizadoFirestore[]> {
  const tipoId = params.tipoAnaliseId.trim();
  if (!tipoId) return [];

  const maxItems = Math.max(1, Math.min(params.maxItems ?? DEFAULT_MAX_ITEMS, 20));
  const orgId = params.organizacaoId?.trim() || null;

  try {
    const db = getFirestore();
    // Query por status; filtro fino de tipo/org em memória (evita índice composto obrigatório).
    const snap = await db
      .collection(COLLECTION)
      .where("status", "==", "aprovado")
      .limit(80)
      .get();

    const items = snap.docs
      .map((doc) => parseDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter((item): item is FeedbackAprendizadoFirestore => Boolean(item))
      .filter((item) => item.tipoAnaliseId === tipoId)
      .filter((item) => {
        // Sem org no feedback → vale para o tipo inteiro.
        // Com org → só se bater com a concessionária da solicitação.
        if (!item.organizacaoId) return true;
        if (!orgId) return false;
        return item.organizacaoId === orgId;
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs || b.createdAtMs - a.createdAtMs)
      .slice(0, maxItems);

    return items;
  } catch (err) {
    console.warn("Falha ao carregar feedbacksAprendizado aprovados:", err);
    return [];
  }
}

export function buildFeedbackAprendizadoPromptBlock(
  items: FeedbackAprendizadoFirestore[],
  options?: { maxCharsPerField?: number; maxBlockChars?: number },
): string {
  if (!items.length) return "";

  const maxField = options?.maxCharsPerField ?? DEFAULT_MAX_CHARS_FIELD;
  const maxBlock = options?.maxBlockChars ?? DEFAULT_MAX_BLOCK_CHARS;

  const linhas: string[] = [
    "═══════════════════════════════════════",
    "APRENDIZADO VALIDADO (FEEDBACKS APROVADOS — MESMO TIPO)",
    "═══════════════════════════════════════",
    "Use somente como correção de interpretação para ESTE tipo de análise.",
    "NÃO generalize para outros tipos. NÃO invente normas. Em conflito com",
    "normas/PDFs anexados ou com o checklist do tipo, prevalecem normas + evidência documental.",
    "Feedback pendente/rejeitado/rascunho NÃO deve ser considerado (já filtrado).",
    "",
  ];

  items.forEach((item, index) => {
    linhas.push(
      `${index + 1}) Item/regra: ${truncate(item.regraOuItem, maxField)}`,
      `   - Errado (evitar): ${truncate(item.original, maxField)}`,
      `   - Correto (preferir): ${truncate(item.correcao, maxField)}`,
      `   - Justificativa: ${truncate(item.justificativa, maxField)}`,
      "",
    );
  });

  let block = linhas.join("\n").trim();
  if (block.length > maxBlock) {
    block = `${block.slice(0, maxBlock - 1)}…`;
  }
  return block;
}
