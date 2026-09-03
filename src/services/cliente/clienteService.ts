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
import type { Cliente, ClienteDraft } from '../../models/Cliente'
import { auth } from '../../lib/firebase'

const COLLECTION_NAME =
  import.meta.env.VITE_FIRESTORE_CLIENTES_COLLECTION?.trim() || 'clientes'

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

const parseCliente = (id: string, raw: Record<string, unknown>): Cliente => ({
  id,
  razaoSocial: String(raw.razaoSocial ?? '').trim(),
  nomeFantasia: raw.nomeFantasia != null ? String(raw.nomeFantasia) : null,
  cnpj: raw.cnpj != null ? String(raw.cnpj) : null,
  email: raw.email != null ? String(raw.email) : null,
  telefone: raw.telefone != null ? String(raw.telefone) : null,
  contatoNome: raw.contatoNome != null ? String(raw.contatoNome) : null,
  observacoes: raw.observacoes != null ? String(raw.observacoes) : null,
  ativo: raw.ativo !== false,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
})

export async function listClientes(options?: { includeInactive?: boolean }): Promise<Cliente[]> {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('razaoSocial')))
  return snap.docs
    .map((item) => parseCliente(item.id, item.data() as Record<string, unknown>))
    .filter((item) => (options?.includeInactive ? true : item.ativo))
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id))
  if (!snap.exists()) return null
  return parseCliente(snap.id, snap.data() as Record<string, unknown>)
}

export async function createCliente(draft: ClienteDraft): Promise<Cliente> {
  const razaoSocial = draft.razaoSocial.trim()
  if (!razaoSocial) {
    throw new Error('Informe a razão social do cliente.')
  }

  const payload = {
    razaoSocial,
    nomeFantasia: normalizeOptional(draft.nomeFantasia),
    cnpj: normalizeOptional(draft.cnpj),
    email: normalizeOptional(draft.email),
    telefone: normalizeOptional(draft.telefone),
    contatoNome: normalizeOptional(draft.contatoNome),
    observacoes: normalizeOptional(draft.observacoes),
    ativo: draft.ativo !== false,
    createdBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const created = await addDoc(collection(db, COLLECTION_NAME), payload)
  const saved = await getClienteById(created.id)
  if (!saved) {
    throw new Error('Cliente criado, mas não foi possível recarregar o registro.')
  }
  return saved
}

export async function updateCliente(id: string, draft: ClienteDraft): Promise<Cliente> {
  const razaoSocial = draft.razaoSocial.trim()
  if (!razaoSocial) {
    throw new Error('Informe a razão social do cliente.')
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    razaoSocial,
    nomeFantasia: normalizeOptional(draft.nomeFantasia),
    cnpj: normalizeOptional(draft.cnpj),
    email: normalizeOptional(draft.email),
    telefone: normalizeOptional(draft.telefone),
    contatoNome: normalizeOptional(draft.contatoNome),
    observacoes: normalizeOptional(draft.observacoes),
    ativo: draft.ativo !== false,
    updatedAt: serverTimestamp(),
  })

  const saved = await getClienteById(id)
  if (!saved) {
    throw new Error('Cliente atualizado, mas não foi possível recarregar o registro.')
  }
  return saved
}
