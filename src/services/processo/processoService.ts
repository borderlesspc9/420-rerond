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
  where,
  type Timestamp,
} from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import type { Processo, ProcessoDraft, ProcessoStatus } from '../../models/Processo'
import { formatRevisao } from '../../models/Processo'

const COLLECTION_NAME =
  import.meta.env.VITE_FIRESTORE_PROCESSOS_COLLECTION?.trim() || 'processos'

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  return undefined
}

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const parseStatus = (value: unknown): ProcessoStatus => {
  if (
    value === 'em_analise' ||
    value === 'aguardando_revisao' ||
    value === 'concluido' ||
    value === 'arquivado'
  ) {
    return value
  }
  return 'aberto'
}

const parseProcesso = (id: string, raw: Record<string, unknown>): Processo => ({
  id,
  codigo: raw.codigo != null ? String(raw.codigo) : null,
  titulo: String(raw.titulo ?? '').trim(),
  clienteId: raw.clienteId != null ? String(raw.clienteId) : null,
  clienteNome: raw.clienteNome != null ? String(raw.clienteNome) : null,
  concessionariaId: raw.concessionariaId != null ? String(raw.concessionariaId) : null,
  nomeConcessionaria:
    raw.nomeConcessionaria != null ? String(raw.nomeConcessionaria) : null,
  rodovia: raw.rodovia != null ? String(raw.rodovia) : null,
  status: parseStatus(raw.status),
  revisaoAtual: String(raw.revisaoAtual ?? 'R00'),
  ultimaSolicitacaoId:
    raw.ultimaSolicitacaoId != null ? String(raw.ultimaSolicitacaoId) : null,
  ativo: raw.ativo !== false,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
})

export async function listProcessos(): Promise<Processo[]> {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc')))
  return snap.docs
    .map((item) => parseProcesso(item.id, item.data() as Record<string, unknown>))
    .filter((item) => item.ativo)
}

export async function getProcessoById(id: string): Promise<Processo | null> {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id))
  if (!snap.exists()) return null
  return parseProcesso(snap.id, snap.data() as Record<string, unknown>)
}

export async function createProcesso(draft: ProcessoDraft): Promise<Processo> {
  const titulo = draft.titulo.trim()
  if (!titulo) {
    throw new Error('Informe o título do processo.')
  }

  const payload = {
    titulo,
    codigo: null,
    clienteId: normalizeOptional(draft.clienteId),
    clienteNome: normalizeOptional(draft.clienteNome),
    concessionariaId: normalizeOptional(draft.concessionariaId),
    nomeConcessionaria: normalizeOptional(draft.nomeConcessionaria),
    rodovia: normalizeOptional(draft.rodovia),
    status: draft.status ?? 'aberto',
    revisaoAtual: formatRevisao(0),
    ultimaSolicitacaoId: null,
    ativo: true,
    createdBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const created = await addDoc(collection(db, COLLECTION_NAME), payload)
  await updateDoc(doc(db, COLLECTION_NAME, created.id), {
    codigo: `PROC-${created.id.slice(0, 8).toUpperCase()}`,
  })

  const saved = await getProcessoById(created.id)
  if (!saved) throw new Error('Processo criado, mas não foi possível recarregar.')
  return saved
}

export async function updateProcesso(
  id: string,
  patch: Partial<ProcessoDraft> & {
    revisaoAtual?: string
    ultimaSolicitacaoId?: string | null
    status?: ProcessoStatus
  },
): Promise<Processo> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (patch.titulo != null) payload.titulo = patch.titulo.trim()
  if (patch.clienteId !== undefined) payload.clienteId = normalizeOptional(patch.clienteId)
  if (patch.clienteNome !== undefined) {
    payload.clienteNome = normalizeOptional(patch.clienteNome)
  }
  if (patch.concessionariaId !== undefined) {
    payload.concessionariaId = normalizeOptional(patch.concessionariaId)
  }
  if (patch.nomeConcessionaria !== undefined) {
    payload.nomeConcessionaria = normalizeOptional(patch.nomeConcessionaria)
  }
  if (patch.rodovia !== undefined) payload.rodovia = normalizeOptional(patch.rodovia)
  if (patch.status != null) payload.status = patch.status
  if (patch.revisaoAtual != null) payload.revisaoAtual = patch.revisaoAtual
  if (patch.ultimaSolicitacaoId !== undefined) {
    payload.ultimaSolicitacaoId = patch.ultimaSolicitacaoId
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), payload)
  const saved = await getProcessoById(id)
  if (!saved) throw new Error('Processo atualizado, mas não foi possível recarregar.')
  return saved
}

export async function listSolicitacoesByProcesso(processoId: string) {
  const snap = await getDocs(
    query(collection(db, 'solicitacoes'), where('processoId', '==', processoId)),
  )
  return snap.docs
    .map((item) => ({ id: item.id, ...(item.data() as Record<string, unknown>) }))
    .sort((a, b) => {
      const aTime =
        a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt
          ? Number((a.createdAt as { toMillis: () => number }).toMillis())
          : 0
      const bTime =
        b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt
          ? Number((b.createdAt as { toMillis: () => number }).toMillis())
          : 0
      return aTime - bTime
    })
}
