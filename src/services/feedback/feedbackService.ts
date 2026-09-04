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
import { auth, db } from '../../lib/firebase'
import type {
  FeedbackAprendizado,
  FeedbackAprendizadoDraft,
  FeedbackValidacaoStatus,
} from '../../models/FeedbackAprendizado'

const COLLECTION =
  import.meta.env.VITE_FIRESTORE_FEEDBACKS_COLLECTION?.trim() || 'feedbacksAprendizado'

const MOCK_KEY = 'rerond-feedbacks-mock-v1'
let mockMode = false

export function isFeedbacksMockMode(): boolean {
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

const parse = (id: string, raw: Record<string, unknown>): FeedbackAprendizado => ({
  id,
  solicitacaoId: raw.solicitacaoId != null ? String(raw.solicitacaoId) : null,
  tipoAnaliseId: raw.tipoAnaliseId != null ? String(raw.tipoAnaliseId) : null,
  organizacaoId: raw.organizacaoId != null ? String(raw.organizacaoId) : null,
  regraOuItem: String(raw.regraOuItem ?? ''),
  original: String(raw.original ?? ''),
  correcao: String(raw.correcao ?? ''),
  justificativa: String(raw.justificativa ?? ''),
  status: (raw.status as FeedbackValidacaoStatus) || 'pendente',
  autorId: raw.autorId != null ? String(raw.autorId) : null,
  autorNome: raw.autorNome != null ? String(raw.autorNome) : null,
  revisadoPorId: raw.revisadoPorId != null ? String(raw.revisadoPorId) : null,
  revisaoNota: raw.revisaoNota != null ? String(raw.revisaoNota) : null,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
})

const readMock = (): FeedbackAprendizado[] => {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FeedbackAprendizado[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeMock = (items: FeedbackAprendizado[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items))
}

export async function listFeedbacks(options?: {
  status?: FeedbackValidacaoStatus
  tipoAnaliseId?: string
}): Promise<FeedbackAprendizado[]> {
  const filterLocal = (items: FeedbackAprendizado[]) =>
    items.filter((item) => {
      if (options?.status && item.status !== options.status) return false
      if (options?.tipoAnaliseId && item.tipoAnaliseId !== options.tipoAnaliseId) return false
      return true
    })

  if (mockMode) return filterLocal(readMock())

  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')))
    return filterLocal(
      snap.docs.map((item) => parse(item.id, item.data() as Record<string, unknown>)),
    )
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return filterLocal(readMock())
    }
    throw err
  }
}

export async function listFeedbacksAprovadosPorTipo(
  tipoAnaliseId: string,
): Promise<FeedbackAprendizado[]> {
  return listFeedbacks({ status: 'aprovado', tipoAnaliseId })
}

export async function createFeedback(
  draft: FeedbackAprendizadoDraft,
): Promise<FeedbackAprendizado> {
  if (!draft.regraOuItem.trim()) throw new Error('Informe o item/regra corrigido.')
  if (!draft.original.trim()) throw new Error('Informe o trecho original (errado).')
  if (!draft.correcao.trim()) throw new Error('Informe a correção correta.')
  if (!draft.justificativa.trim()) throw new Error('Informe a justificativa técnica.')

  const base = {
    solicitacaoId: draft.solicitacaoId ?? null,
    tipoAnaliseId: draft.tipoAnaliseId ?? null,
    organizacaoId: draft.organizacaoId ?? null,
    regraOuItem: draft.regraOuItem.trim(),
    original: draft.original.trim(),
    correcao: draft.correcao.trim(),
    justificativa: draft.justificativa.trim(),
    status: draft.status ?? 'pendente',
    autorId: draft.autorId ?? auth.currentUser?.uid ?? null,
    autorNome: draft.autorNome ?? auth.currentUser?.email ?? null,
    revisadoPorId: null,
    revisaoNota: null,
  }

  if (mockMode) {
    const item: FeedbackAprendizado = {
      id: `fb-${Date.now()}`,
      ...base,
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
      return createFeedback(draft)
    }
    throw err
  }
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackValidacaoStatus,
  revisaoNota?: string,
): Promise<FeedbackAprendizado> {
  if (mockMode) {
    const items = readMock()
    const idx = items.findIndex((item) => item.id === id)
    if (idx < 0) throw new Error('Feedback não encontrado.')
    items[idx] = {
      ...items[idx],
      status,
      revisaoNota: revisaoNota ?? items[idx].revisaoNota,
      revisadoPorId: auth.currentUser?.uid ?? null,
      updatedAt: new Date(),
    }
    writeMock(items)
    return items[idx]
  }

  try {
    await updateDoc(doc(db, COLLECTION, id), {
      status,
      revisaoNota: revisaoNota ?? null,
      revisadoPorId: auth.currentUser?.uid ?? null,
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(doc(db, COLLECTION, id))
    if (!snap.exists()) throw new Error('Feedback não encontrado.')
    return parse(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return setFeedbackStatus(id, status, revisaoNota)
    }
    throw err
  }
}
