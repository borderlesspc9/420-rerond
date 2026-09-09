import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type {
  GoldenCase,
  GoldenCaseDraft,
  GoldenCasePar,
  GoldenCaseValidacaoStatus,
} from '../../models/GoldenCase'
import {
  normalizeDocumentosRef,
  normalizePares,
  parseGoldenStatus,
} from '../../utils/goldenCasePrompt'
import { GOLDEN_CASES_SEED } from './goldenCaseSeed'

const COLLECTION =
  import.meta.env.VITE_FIRESTORE_GOLDEN_CASES_COLLECTION?.trim() || 'goldenCases'

const MOCK_KEY = 'rerond-golden-cases-mock-v2'
let mockMode = false
let seedApplied = false

export function isGoldenCasesMockMode(): boolean {
  return mockMode
}

const isPermissionError = (err: unknown) => {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  return (
    code.includes('permission-denied') ||
    message.toLowerCase().includes('insufficient permissions') ||
    message.toLowerCase().includes('missing or insufficient permissions')
  )
}

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  return undefined
}

export const parseGoldenCase = (
  id: string,
  raw: Record<string, unknown>,
): GoldenCase => {
  const erroIa = raw.erroIa ? String(raw.erroIa) : undefined
  const analiseCorreta = String(raw.analiseCorreta ?? '')
  const pares = normalizePares(raw.pares, { erroIa, analiseCorreta })
  return {
    id,
    codigo: String(raw.codigo ?? ''),
    titulo: String(raw.titulo ?? ''),
    tipoAnaliseId: String(raw.tipoAnaliseId ?? ''),
    organizacaoId: raw.organizacaoId != null ? String(raw.organizacaoId) : null,
    descricao: raw.descricao ? String(raw.descricao) : undefined,
    erroIa,
    analiseCorreta,
    observacoes: raw.observacoes ? String(raw.observacoes) : undefined,
    pares,
    documentosRef: normalizeDocumentosRef(raw.documentosRef),
    status: parseGoldenStatus(raw.status),
    ativo: raw.ativo !== false,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  }
}

const readMock = (): GoldenCase[] => {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Record<string, unknown> & { id: string }>
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) =>
      parseGoldenCase(item.id, {
        ...item,
        createdAt: item.createdAt ? new Date(String(item.createdAt)) : undefined,
        updatedAt: item.updatedAt ? new Date(String(item.updatedAt)) : undefined,
      } as Record<string, unknown>),
    )
  } catch {
    return []
  }
}

const writeMock = (items: GoldenCase[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items))
}

const ensureMockSeed = () => {
  if (seedApplied) return
  seedApplied = true
  const current = readMock()
  if (current.length > 0) return
  const seeded: GoldenCase[] = GOLDEN_CASES_SEED.map((item, index) => ({
    ...item,
    id: item.id || `seed-gc-${index + 1}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  writeMock(seeded)
}

const serializePares = (pares: GoldenCasePar[]) =>
  pares.map((par) => ({
    id: par.id,
    regraOuItem: par.regraOuItem ?? null,
    original: par.original.trim(),
    correto: par.correto.trim(),
    justificativa: par.justificativa.trim(),
  }))

const validateDraft = (draft: GoldenCaseDraft) => {
  if (!draft.codigo?.trim()) throw new Error('Informe o código do caso (ex.: ocupacao-faixa/caso-001).')
  if (!draft.titulo?.trim()) throw new Error('Informe o título do caso modelo.')
  if (!draft.tipoAnaliseId?.trim()) throw new Error('Vincule o caso a um tipo de análise.')

  const pares = normalizePares(draft.pares, {
    erroIa: draft.erroIa,
    analiseCorreta: draft.analiseCorreta,
  })
  if (pares.length === 0 && !draft.analiseCorreta?.trim()) {
    throw new Error('Informe ao menos um par errado×certo (original, correto e justificativa).')
  }
  if (pares.length === 0) {
    throw new Error('Cada par precisa de original, correto e justificativa.')
  }
  return pares
}

export async function listGoldenCases(
  tipoAnaliseIdOrOptions?:
    | string
    | {
        tipoAnaliseId?: string
        status?: GoldenCaseValidacaoStatus
        includeInactive?: boolean
        search?: string
      },
): Promise<GoldenCase[]> {
  const options =
    typeof tipoAnaliseIdOrOptions === 'string'
      ? { tipoAnaliseId: tipoAnaliseIdOrOptions }
      : tipoAnaliseIdOrOptions ?? {}

  const filter = (items: GoldenCase[]) =>
    items.filter((item) => {
      if (!options.includeInactive && item.ativo === false) return false
      if (options.tipoAnaliseId && item.tipoAnaliseId !== options.tipoAnaliseId) return false
      if (options.status && item.status !== options.status) return false
      if (options.search) {
        const q = options.search.trim().toLowerCase()
        if (!q) return true
        const hay = `${item.codigo} ${item.titulo} ${item.descricao ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

  if (mockMode) {
    ensureMockSeed()
    return filter(readMock())
  }

  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('codigo')))
    return filter(snap.docs.map((item) => parseGoldenCase(item.id, item.data() as Record<string, unknown>)))
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      ensureMockSeed()
      return filter(readMock())
    }
    throw err
  }
}

/** @deprecated use listGoldenCases({ tipoAnaliseId }) */
export async function listGoldenCasesByTipo(tipoAnaliseId?: string): Promise<GoldenCase[]> {
  return listGoldenCases({ tipoAnaliseId })
}

export function suggestGoldenCodigo(
  tipoSlugOrId: string,
  existing: GoldenCase[],
): string {
  const slug = (tipoSlugOrId || 'caso')
    .trim()
    .toLowerCase()
    .replace(/^tipo-/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'caso'

  const prefix = `${slug}/caso-`
  let max = 0
  for (const item of existing) {
    if (!item.codigo.startsWith(prefix)) continue
    const n = Number(item.codigo.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export async function createGoldenCase(draft: GoldenCaseDraft): Promise<GoldenCase> {
  const pares = validateDraft(draft)
  const documentosRef = normalizeDocumentosRef(draft.documentosRef)
  const analiseCorreta =
    draft.analiseCorreta?.trim() ||
    pares.map((p) => p.correto).join('\n\n') ||
    ''

  const base = {
    codigo: draft.codigo.trim(),
    titulo: draft.titulo.trim(),
    tipoAnaliseId: draft.tipoAnaliseId.trim(),
    organizacaoId: draft.organizacaoId ?? null,
    descricao: draft.descricao?.trim() || null,
    erroIa: draft.erroIa?.trim() || pares[0]?.original || null,
    analiseCorreta,
    observacoes: draft.observacoes?.trim() || null,
    pares: serializePares(pares),
    documentosRef,
    status: (draft.status ?? 'pendente') as GoldenCaseValidacaoStatus,
    ativo: draft.ativo !== false,
  }

  if (mockMode) {
    ensureMockSeed()
    const item = parseGoldenCase(`gc-${Date.now()}`, {
      ...base,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Record<string, unknown>)
    writeMock([item, ...readMock()])
    return item
  }

  try {
    const created = await addDoc(collection(db, COLLECTION), {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(created)
    return parseGoldenCase(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return createGoldenCase(draft)
    }
    throw err
  }
}

export async function updateGoldenCase(
  id: string,
  patch: Partial<GoldenCaseDraft>,
): Promise<GoldenCase> {
  const payload: Record<string, unknown> = { ...patch }
  if (patch.pares) {
    payload.pares = serializePares(
      normalizePares(patch.pares, {
        erroIa: patch.erroIa,
        analiseCorreta: patch.analiseCorreta,
      }),
    )
  }
  if (patch.documentosRef) {
    payload.documentosRef = normalizeDocumentosRef(patch.documentosRef)
  }

  if (mockMode) {
    ensureMockSeed()
    const items = readMock()
    const idx = items.findIndex((item) => item.id === id)
    if (idx < 0) throw new Error('Golden case não encontrado.')
    const merged = parseGoldenCase(id, {
      ...items[idx],
      ...payload,
      updatedAt: new Date(),
    } as unknown as Record<string, unknown>)
    items[idx] = merged
    writeMock(items)
    return merged
  }

  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...payload,
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(doc(db, COLLECTION, id))
    if (!snap.exists()) throw new Error('Golden case não encontrado.')
    return parseGoldenCase(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return updateGoldenCase(id, patch)
    }
    throw err
  }
}

export async function setGoldenCaseStatus(
  id: string,
  status: GoldenCaseValidacaoStatus,
  revisaoNota?: string,
): Promise<GoldenCase> {
  let observacoesAtuais: string | undefined

  if (mockMode) {
    ensureMockSeed()
    observacoesAtuais = readMock().find((item) => item.id === id)?.observacoes
  } else {
    try {
      const snap = await getDoc(doc(db, COLLECTION, id))
      if (snap.exists()) {
        const raw = snap.data() as Record<string, unknown>
        observacoesAtuais = raw.observacoes ? String(raw.observacoes) : undefined
      }
    } catch {
      // segue sem merge se leitura falhar
    }
  }

  const observacoes = revisaoNota
    ? [observacoesAtuais, revisaoNota].filter(Boolean).join('\n')
    : observacoesAtuais

  return updateGoldenCase(id, { status, observacoes })
}

export async function setGoldenCaseAtivo(id: string, ativo: boolean): Promise<GoldenCase> {
  return updateGoldenCase(id, { ativo })
}
