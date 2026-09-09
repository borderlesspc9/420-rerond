import type {
  GoldenCase,
  GoldenCaseDocumentoRef,
  GoldenCasePar,
  GoldenCaseValidacaoStatus,
} from '../models/GoldenCase'

const MAX_CHARS = 500
const MAX_BLOCK = 8000

function truncate(value: string, max = MAX_CHARS): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

/** Bloco de prompt espelhado no backend — usado no preview sem OpenAI. */
export function buildGoldenCasesPromptBlockFromCases(
  items: Array<{
    id: string
    codigo: string
    titulo: string
    analiseCorreta: string
    erroIa?: string
    pares: GoldenCasePar[]
  }>,
): { block: string; ids: string[] } {
  if (!items.length) {
    return { block: '', ids: [] }
  }

  const linhas: string[] = [
    '═══════════════════════════════════════',
    'CASOS MODELO (GOLDEN CASES — MESMO TIPO)',
    '═══════════════════════════════════════',
    'Use como referência de qualidade para ESTE tipo de análise.',
    'NÃO copie fatos dos documentos do caso modelo como se fossem da solicitação atual.',
    'Em conflito com normas/PDFs anexados da solicitação, prevalecem normas + evidência documental.',
    'Casos rascunho/pendente/rejeitado/inativos NÃO devem ser considerados (já filtrados).',
    '',
  ]

  items.forEach((item, index) => {
    linhas.push(
      `${index + 1}) [${item.codigo}] ${truncate(item.titulo, 200)}`,
      `   Resumo análise correta: ${truncate(item.analiseCorreta || '(não informado)', 600)}`,
    )
    if (item.erroIa?.trim()) {
      linhas.push(`   Erro típico da IA (evitar): ${truncate(item.erroIa, 400)}`)
    }
    const pares = item.pares?.length
      ? item.pares
      : item.erroIa?.trim()
        ? [
            {
              id: 'legacy',
              original: item.erroIa,
              correto: item.analiseCorreta,
              justificativa: 'Derivado do caso legado.',
            },
          ]
        : []
    pares.forEach((par, pi) => {
      linhas.push(
        `   Par ${pi + 1}${par.regraOuItem ? ` (${truncate(par.regraOuItem, 80)})` : ''}:`,
        `     - Errado: ${truncate(par.original)}`,
        `     - Correto: ${truncate(par.correto)}`,
        `     - Justificativa: ${truncate(par.justificativa)}`,
      )
    })
    linhas.push('')
  })

  let block = linhas.join('\n').trim()
  if (block.length > MAX_BLOCK) {
    block = `${block.slice(0, MAX_BLOCK - 1)}…`
  }
  return { block, ids: items.map((i) => i.id) }
}

export function filterGoldenCasesAprovadosParaPreview(
  all: GoldenCase[],
  tipoAnaliseId: string,
  maxItems = 3,
): GoldenCase[] {
  const tipo = tipoAnaliseId.trim()
  if (!tipo) return []
  return all
    .filter(
      (item) =>
        item.ativo !== false &&
        item.status === 'aprovado' &&
        item.tipoAnaliseId === tipo,
    )
    .sort((a, b) => {
      const am = a.updatedAt?.getTime?.() ?? a.createdAt?.getTime?.() ?? 0
      const bm = b.updatedAt?.getTime?.() ?? b.createdAt?.getTime?.() ?? 0
      return bm - am
    })
    .slice(0, maxItems)
}

export function normalizeDocumentosRef(
  raw: unknown,
): GoldenCaseDocumentoRef[] {
  if (!Array.isArray(raw)) return []
  const out: GoldenCaseDocumentoRef[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const nome = item.trim()
      if (nome) out.push({ nome, url: null, storagePath: null })
      continue
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const nome = String(obj.nome ?? obj.name ?? '').trim()
      if (!nome) continue
      out.push({
        nome,
        url: obj.url != null ? String(obj.url) : null,
        storagePath: obj.storagePath != null ? String(obj.storagePath) : null,
      })
    }
  }
  return out
}

export function normalizePares(
  raw: unknown,
  fallback?: { erroIa?: string; analiseCorreta?: string },
): GoldenCasePar[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const out: GoldenCasePar[] = []
    raw.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const obj = item as Record<string, unknown>
      const original = String(obj.original ?? '').trim()
      const correto = String(obj.correto ?? '').trim()
      const justificativa = String(obj.justificativa ?? '').trim()
      if (!original || !correto || !justificativa) return
      out.push({
        id: String(obj.id ?? `par-${index + 1}`),
        regraOuItem: obj.regraOuItem ? String(obj.regraOuItem).trim() : undefined,
        original,
        correto,
        justificativa,
      })
    })
    return out
  }

  const erro = fallback?.erroIa?.trim()
  const correta = fallback?.analiseCorreta?.trim()
  if (erro && correta) {
    return [
      {
        id: 'par-legado',
        original: erro,
        correto: correta,
        justificativa: 'Par derivado do registro legado (erroIa × analiseCorreta).',
      },
    ]
  }
  return []
}

export function parseGoldenStatus(raw: unknown): GoldenCaseValidacaoStatus {
  const value = String(raw ?? '').trim()
  if (
    value === 'rascunho' ||
    value === 'pendente' ||
    value === 'aprovado' ||
    value === 'rejeitado'
  ) {
    return value
  }
  // Legado sem status: trata como aprovado se ativo (comportamento anterior de listagem)
  return 'aprovado'
}

export function newParId(): string {
  return `par-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
