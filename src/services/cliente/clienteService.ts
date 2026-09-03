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

const MOCK_STORAGE_KEY = 'rerond-clientes-mock-v1'

const SEED_MOCK_CLIENTES: Cliente[] = [
  {
    id: 'mock-comunyca',
    razaoSocial: 'Comunyca Publicidade e Serviços Ltda.',
    nomeFantasia: 'Comunyca',
    cnpj: '12.345.678/0001-90',
    email: 'projetos@comunyca.example',
    telefone: '(27) 3333-1000',
    contatoNome: 'Ana Souza',
    observacoes: 'Cliente de demonstração — substituir quando o Firestore de clientes estiver publicado.',
    ativo: true,
  },
  {
    id: 'mock-ohr',
    razaoSocial: 'OHR TELECOM EIRELI',
    nomeFantasia: 'OHR Telecom',
    cnpj: '98.765.432/0001-10',
    email: 'engenharia@ohr.example',
    telefone: '(27) 3222-4500',
    contatoNome: 'Carlos Mendes',
    observacoes: 'Ocupações de rede em faixa de domínio (dados mock).',
    ativo: true,
  },
  {
    id: 'mock-energia',
    razaoSocial: 'Companhia Energética Exemplo S/A',
    nomeFantasia: 'Energia Exemplo',
    cnpj: '11.222.333/0001-44',
    email: 'faixadedominio@energia.example',
    telefone: '(27) 4000-2000',
    contatoNome: 'Juliana Prado',
    observacoes: 'Travessias aéreas — registro provisório para UI.',
    ativo: true,
  },
]

let mockMode = false

export function isClientesMockMode(): boolean {
  return mockMode
}

const isPermissionError = (err: unknown) => {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  return (
    code.includes('permission-denied') ||
    message.toLowerCase().includes('insufficient permissions') ||
    message.toLowerCase().includes('missing or insufficient permissions')
  )
}

const readMockStore = (): Cliente[] => {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return [...SEED_MOCK_CLIENTES]
    const parsed = JSON.parse(raw) as Cliente[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [...SEED_MOCK_CLIENTES]
    return parsed
  } catch {
    return [...SEED_MOCK_CLIENTES]
  }
}

const writeMockStore = (clientes: Cliente[]) => {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(clientes))
}

const persistMockCliente = (cliente: Cliente) => {
  const current = readMockStore()
  const next = current.some((item) => item.id === cliente.id)
    ? current.map((item) => (item.id === cliente.id ? cliente : item))
    : [cliente, ...current]
  writeMockStore(next)
  return cliente
}

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
  try {
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('razaoSocial')))
    mockMode = false
    return snap.docs
      .map((item) => parseCliente(item.id, item.data() as Record<string, unknown>))
      .filter((item) => (options?.includeInactive ? true : item.ativo))
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    console.warn('Firestore clientes indisponível; usando dados mock locais.')
    return readMockStore().filter((item) => (options?.includeInactive ? true : item.ativo))
  }
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  if (mockMode || id.startsWith('mock-')) {
    return readMockStore().find((item) => item.id === id) ?? null
  }
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id))
    if (!snap.exists()) return null
    return parseCliente(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return readMockStore().find((item) => item.id === id) ?? null
  }
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

  if (mockMode) {
    return persistMockCliente({
      id: `mock-${Date.now()}`,
      razaoSocial,
      nomeFantasia: payload.nomeFantasia,
      cnpj: payload.cnpj,
      email: payload.email,
      telefone: payload.telefone,
      contatoNome: payload.contatoNome,
      observacoes: payload.observacoes,
      ativo: payload.ativo,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  try {
    const created = await addDoc(collection(db, COLLECTION_NAME), payload)
    const saved = await getClienteById(created.id)
    if (!saved) {
      throw new Error('Cliente criado, mas não foi possível recarregar o registro.')
    }
    return saved
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return persistMockCliente({
      id: `mock-${Date.now()}`,
      razaoSocial,
      nomeFantasia: payload.nomeFantasia,
      cnpj: payload.cnpj,
      email: payload.email,
      telefone: payload.telefone,
      contatoNome: payload.contatoNome,
      observacoes: payload.observacoes,
      ativo: payload.ativo,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

export async function updateCliente(id: string, draft: ClienteDraft): Promise<Cliente> {
  const razaoSocial = draft.razaoSocial.trim()
  if (!razaoSocial) {
    throw new Error('Informe a razão social do cliente.')
  }

  if (mockMode || id.startsWith('mock-')) {
    const current = readMockStore().find((item) => item.id === id)
    return persistMockCliente({
      id,
      razaoSocial,
      nomeFantasia: normalizeOptional(draft.nomeFantasia),
      cnpj: normalizeOptional(draft.cnpj),
      email: normalizeOptional(draft.email),
      telefone: normalizeOptional(draft.telefone),
      contatoNome: normalizeOptional(draft.contatoNome),
      observacoes: normalizeOptional(draft.observacoes),
      ativo: draft.ativo !== false,
      createdAt: current?.createdAt,
      updatedAt: new Date(),
    })
  }

  try {
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
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return persistMockCliente({
      id,
      razaoSocial,
      nomeFantasia: normalizeOptional(draft.nomeFantasia),
      cnpj: normalizeOptional(draft.cnpj),
      email: normalizeOptional(draft.email),
      telefone: normalizeOptional(draft.telefone),
      contatoNome: normalizeOptional(draft.contatoNome),
      observacoes: normalizeOptional(draft.observacoes),
      ativo: draft.ativo !== false,
      updatedAt: new Date(),
    })
  }
}
