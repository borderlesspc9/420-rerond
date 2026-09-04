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
import type { GoldenCase, GoldenCaseDraft } from '../../models/GoldenCase'

const COLLECTION =
  import.meta.env.VITE_FIRESTORE_GOLDEN_CASES_COLLECTION?.trim() || 'goldenCases'

const MOCK_KEY = 'rerond-golden-cases-mock-v1'
let mockMode = false

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

const parse = (id: string, raw: Record<string, unknown>): GoldenCase => ({
  id,
  codigo: String(raw.codigo ?? ''),
  titulo: String(raw.titulo ?? ''),
  tipoAnaliseId: String(raw.tipoAnaliseId ?? ''),
  organizacaoId: raw.organizacaoId != null ? String(raw.organizacaoId) : null,
  descricao: raw.descricao ? String(raw.descricao) : undefined,
  erroIa: raw.erroIa ? String(raw.erroIa) : undefined,
  analiseCorreta: String(raw.analiseCorreta ?? ''),
  observacoes: raw.observacoes ? String(raw.observacoes) : undefined,
  documentosRef: Array.isArray(raw.documentosRef) ? raw.documentosRef.map(String) : [],
  ativo: raw.ativo !== false,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
})

const readMock = (): GoldenCase[] => {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GoldenCase[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeMock = (items: GoldenCase[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items))
}

export async function listGoldenCases(tipoAnaliseId?: string): Promise<GoldenCase[]> {
  const filter = (items: GoldenCase[]) =>
    items.filter((item) => {
      if (!item.ativo) return false
      if (tipoAnaliseId && item.tipoAnaliseId !== tipoAnaliseId) return false
      return true
    })

  if (mockMode) return filter(readMock())

  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('codigo')))
    return filter(snap.docs.map((item) => parse(item.id, item.data() as Record<string, unknown>)))
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return filter(readMock())
    }
    throw err
  }
}

export async function createGoldenCase(draft: GoldenCaseDraft): Promise<GoldenCase> {
  if (!draft.codigo.trim()) throw new Error('Informe o código do caso (ex.: ocupacao/caso-001).')
  if (!draft.titulo.trim()) throw new Error('Informe o título do caso modelo.')
  if (!draft.tipoAnaliseId.trim()) throw new Error('Vincule o caso a um tipo de análise.')
  if (!draft.analiseCorreta.trim()) throw new Error('Informe a análise correta de referência.')

  const base = {
    codigo: draft.codigo.trim(),
    titulo: draft.titulo.trim(),
    tipoAnaliseId: draft.tipoAnaliseId.trim(),
    organizacaoId: draft.organizacaoId ?? null,
    descricao: draft.descricao?.trim() || null,
    erroIa: draft.erroIa?.trim() || null,
    analiseCorreta: draft.analiseCorreta.trim(),
    observacoes: draft.observacoes?.trim() || null,
    documentosRef: draft.documentosRef ?? [],
    ativo: draft.ativo !== false,
  }

  if (mockMode) {
    const item: GoldenCase = {
      id: `gc-${Date.now()}`,
      ...base,
      descricao: base.descricao || undefined,
      erroIa: base.erroIa || undefined,
      observacoes: base.observacoes || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
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
    return parse(snap.id, snap.data() as Record<string, unknown>)
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
  if (mockMode) {
    const items = readMock()
    const idx = items.findIndex((item) => item.id === id)
    if (idx < 0) throw new Error('Golden case não encontrado.')
    items[idx] = { ...items[idx], ...patch, id, updatedAt: new Date() } as GoldenCase
    writeMock(items)
    return items[idx]
  }
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(doc(db, COLLECTION, id))
    if (!snap.exists()) throw new Error('Golden case não encontrado.')
    return parse(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return updateGoldenCase(id, patch)
    }
    throw err
  }
}
