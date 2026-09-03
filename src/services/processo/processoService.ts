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

const MOCK_PROCESSOS_KEY = 'rerond-processos-mock-v1'
const MOCK_REVISOES_KEY = 'rerond-processos-revisoes-mock-v1'

type MockRevisao = {
  id: string
  processoId: string
  numeroRevisao?: string
  titulo?: string
  status?: string
  analisadoPorIA?: boolean
  checklistConformidade?: string
  parecerTecnico?: string
  createdAt?: Date | string
}

const CHECKLIST_R00 = JSON.stringify([
  { item: 'MEMORIAL', status: 'NAO_CONFORME', situacaoEncontrada: 'Faltam cotas de FXD' },
  { item: 'ART', status: 'INFORMACAO_AUSENTE', situacaoEncontrada: 'ART não localizada' },
  { item: 'PLANTA', status: 'OK', situacaoEncontrada: 'Planta apresentada' },
])

const CHECKLIST_R01 = JSON.stringify([
  { item: 'MEMORIAL', status: 'OK', situacaoEncontrada: 'Memorial complementar aceito' },
  { item: 'ART', status: 'NAO_CONFORME', situacaoEncontrada: 'ART genérica' },
  { item: 'PLANTA', status: 'OK', situacaoEncontrada: 'Planta atualizada' },
  { item: 'LICENCA', status: 'INFORMACAO_AUSENTE', situacaoEncontrada: 'Licença não anexada' },
])

const SEED_MOCK_PROCESSOS: Processo[] = [
  {
    id: 'mock-proc-comunyca',
    codigo: 'PROC-COMUNYCA',
    titulo: 'Ocupação FXD — outdoor BR-101 km 394+950',
    clienteId: 'mock-comunyca',
    clienteNome: 'Comunyca',
    concessionariaId: 'eco101',
    nomeConcessionaria: 'Ecovias / ECO101',
    rodovia: 'BR-101/ES',
    status: 'em_analise',
    revisaoAtual: 'R01',
    ultimaSolicitacaoId: 'mock-sol-comunyca-r01',
    ativo: true,
    createdAt: new Date('2026-08-10T12:00:00'),
    updatedAt: new Date('2026-08-21T15:23:00'),
  },
  {
    id: 'mock-proc-ohr',
    codigo: 'PROC-OHR',
    titulo: 'Travessia de rede — BR-101 km 85+200',
    clienteId: 'mock-ohr',
    clienteNome: 'OHR Telecom',
    concessionariaId: 'eco101',
    nomeConcessionaria: 'Ecovias / ECO101',
    rodovia: 'BR-101/ES',
    status: 'aberto',
    revisaoAtual: 'R00',
    ultimaSolicitacaoId: 'mock-sol-ohr-r00',
    ativo: true,
    createdAt: new Date('2026-08-18T09:00:00'),
    updatedAt: new Date('2026-08-18T09:00:00'),
  },
  {
    id: 'mock-proc-energia',
    codigo: 'PROC-ENERGIA',
    titulo: 'Travessia aérea de energia — BR-101 km 120',
    clienteId: 'mock-energia',
    clienteNome: 'Energia Exemplo',
    concessionariaId: 'eco101',
    nomeConcessionaria: 'Ecovias / ECO101',
    rodovia: 'BR-101/ES',
    status: 'aguardando_revisao',
    revisaoAtual: 'R02',
    ultimaSolicitacaoId: 'mock-sol-energia-r02',
    ativo: true,
    createdAt: new Date('2026-07-02T10:00:00'),
    updatedAt: new Date('2026-08-28T11:00:00'),
  },
]

const SEED_MOCK_REVISOES: MockRevisao[] = [
  {
    id: 'mock-sol-comunyca-r00',
    processoId: 'mock-proc-comunyca',
    numeroRevisao: 'R00',
    titulo: 'R00 — primeira análise',
    status: 'rejeitada',
    analisadoPorIA: true,
    checklistConformidade: CHECKLIST_R00,
    parecerTecnico: 'Pendências de memorial e ART na R00.',
    createdAt: new Date('2026-08-10T12:00:00'),
  },
  {
    id: 'mock-sol-comunyca-r01',
    processoId: 'mock-proc-comunyca',
    numeroRevisao: 'R01',
    titulo: 'R01 — complementar',
    status: 'em_analise',
    analisadoPorIA: true,
    checklistConformidade: CHECKLIST_R01,
    parecerTecnico: 'Memorial corrigido; ART ainda genérica.',
    createdAt: new Date('2026-08-21T15:23:00'),
  },
  {
    id: 'mock-sol-ohr-r00',
    processoId: 'mock-proc-ohr',
    numeroRevisao: 'R00',
    titulo: 'R00 — protocolo inicial',
    status: 'pendente',
    analisadoPorIA: false,
    createdAt: new Date('2026-08-18T09:00:00'),
  },
  {
    id: 'mock-sol-energia-r00',
    processoId: 'mock-proc-energia',
    numeroRevisao: 'R00',
    titulo: 'R00 — análise inicial',
    status: 'aprovada',
    analisadoPorIA: true,
    checklistConformidade: CHECKLIST_R00,
    parecerTecnico: 'Primeira análise com ressalvas.',
    createdAt: new Date('2026-07-02T10:00:00'),
  },
  {
    id: 'mock-sol-energia-r01',
    processoId: 'mock-proc-energia',
    numeroRevisao: 'R01',
    titulo: 'R01 — ajustes de planta',
    status: 'aprovada',
    analisadoPorIA: true,
    checklistConformidade: CHECKLIST_R01,
    parecerTecnico: 'Planta atualizada; licença ainda ausente.',
    createdAt: new Date('2026-07-20T14:00:00'),
  },
  {
    id: 'mock-sol-energia-r02',
    processoId: 'mock-proc-energia',
    numeroRevisao: 'R02',
    titulo: 'R02 — complementar licença',
    status: 'em_analise',
    analisadoPorIA: true,
    checklistConformidade: JSON.stringify([
      { item: 'MEMORIAL', status: 'OK' },
      { item: 'ART', status: 'OK' },
      { item: 'PLANTA', status: 'OK' },
      { item: 'LICENCA', status: 'NAO_CONFORME' },
    ]),
    parecerTecnico: 'Licença apresentada, porém com validade a confirmar.',
    createdAt: new Date('2026-08-28T11:00:00'),
  },
]

let mockMode = false

export function isProcessosMockMode(): boolean {
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

const readMockProcessos = (): Processo[] => {
  try {
    const raw = localStorage.getItem(MOCK_PROCESSOS_KEY)
    if (!raw) return [...SEED_MOCK_PROCESSOS]
    const parsed = JSON.parse(raw) as Processo[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [...SEED_MOCK_PROCESSOS]
    return parsed.map((item) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
    }))
  } catch {
    return [...SEED_MOCK_PROCESSOS]
  }
}

const writeMockProcessos = (items: Processo[]) => {
  localStorage.setItem(MOCK_PROCESSOS_KEY, JSON.stringify(items))
}

const readMockRevisoes = (): MockRevisao[] => {
  try {
    const raw = localStorage.getItem(MOCK_REVISOES_KEY)
    if (!raw) return [...SEED_MOCK_REVISOES]
    const parsed = JSON.parse(raw) as MockRevisao[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [...SEED_MOCK_REVISOES]
    return parsed
  } catch {
    return [...SEED_MOCK_REVISOES]
  }
}

const persistMockProcesso = (processo: Processo) => {
  const current = readMockProcessos()
  const next = current.some((item) => item.id === processo.id)
    ? current.map((item) => (item.id === processo.id ? processo : item))
    : [processo, ...current]
  writeMockProcessos(next)
  return processo
}

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
  try {
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc')))
    mockMode = false
    return snap.docs
      .map((item) => parseProcesso(item.id, item.data() as Record<string, unknown>))
      .filter((item) => item.ativo)
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    console.warn('Firestore processos indisponível; usando dados mock locais.')
    return readMockProcessos().filter((item) => item.ativo)
  }
}

export async function getProcessoById(id: string): Promise<Processo | null> {
  if (mockMode || id.startsWith('mock-')) {
    return readMockProcessos().find((item) => item.id === id) ?? null
  }
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id))
    if (!snap.exists()) return null
    return parseProcesso(snap.id, snap.data() as Record<string, unknown>)
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return readMockProcessos().find((item) => item.id === id) ?? null
  }
}

export async function createProcesso(draft: ProcessoDraft): Promise<Processo> {
  const titulo = draft.titulo.trim()
  if (!titulo) {
    throw new Error('Informe o título do processo.')
  }

  const payload = {
    titulo,
    codigo: null as string | null,
    clienteId: normalizeOptional(draft.clienteId),
    clienteNome: normalizeOptional(draft.clienteNome),
    concessionariaId: normalizeOptional(draft.concessionariaId),
    nomeConcessionaria: normalizeOptional(draft.nomeConcessionaria),
    rodovia: normalizeOptional(draft.rodovia),
    status: draft.status ?? 'aberto',
    revisaoAtual: formatRevisao(0),
    ultimaSolicitacaoId: null as string | null,
    ativo: true,
    createdBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const saveMock = () => {
    const id = `mock-proc-${Date.now()}`
    return persistMockProcesso({
      id,
      codigo: `PROC-${id.slice(-8).toUpperCase()}`,
      titulo,
      clienteId: payload.clienteId,
      clienteNome: payload.clienteNome,
      concessionariaId: payload.concessionariaId,
      nomeConcessionaria: payload.nomeConcessionaria,
      rodovia: payload.rodovia,
      status: payload.status as ProcessoStatus,
      revisaoAtual: payload.revisaoAtual,
      ultimaSolicitacaoId: null,
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  if (mockMode) return saveMock()

  try {
    const created = await addDoc(collection(db, COLLECTION_NAME), payload)
    await updateDoc(doc(db, COLLECTION_NAME, created.id), {
      codigo: `PROC-${created.id.slice(0, 8).toUpperCase()}`,
    })

    const saved = await getProcessoById(created.id)
    if (!saved) throw new Error('Processo criado, mas não foi possível recarregar.')
    return saved
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return saveMock()
  }
}

export async function updateProcesso(
  id: string,
  patch: Partial<ProcessoDraft> & {
    revisaoAtual?: string
    ultimaSolicitacaoId?: string | null
    status?: ProcessoStatus
  },
): Promise<Processo> {
  const applyPatch = (base: Processo): Processo => ({
    ...base,
    titulo: patch.titulo != null ? patch.titulo.trim() : base.titulo,
    clienteId: patch.clienteId !== undefined ? normalizeOptional(patch.clienteId) : base.clienteId,
    clienteNome:
      patch.clienteNome !== undefined ? normalizeOptional(patch.clienteNome) : base.clienteNome,
    concessionariaId:
      patch.concessionariaId !== undefined
        ? normalizeOptional(patch.concessionariaId)
        : base.concessionariaId,
    nomeConcessionaria:
      patch.nomeConcessionaria !== undefined
        ? normalizeOptional(patch.nomeConcessionaria)
        : base.nomeConcessionaria,
    rodovia: patch.rodovia !== undefined ? normalizeOptional(patch.rodovia) : base.rodovia,
    status: patch.status ?? base.status,
    revisaoAtual: patch.revisaoAtual ?? base.revisaoAtual,
    ultimaSolicitacaoId:
      patch.ultimaSolicitacaoId !== undefined ? patch.ultimaSolicitacaoId : base.ultimaSolicitacaoId,
    updatedAt: new Date(),
  })

  if (mockMode || id.startsWith('mock-')) {
    const current = readMockProcessos().find((item) => item.id === id)
    if (!current) throw new Error('Processo mock não encontrado.')
    return persistMockProcesso(applyPatch(current))
  }

  try {
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
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    const current = readMockProcessos().find((item) => item.id === id)
    if (!current) throw err
    return persistMockProcesso(applyPatch(current))
  }
}

export async function listSolicitacoesByProcesso(processoId: string) {
  if (mockMode || processoId.startsWith('mock-')) {
    return readMockRevisoes()
      .filter((item) => item.processoId === processoId)
      .sort((a, b) => String(a.numeroRevisao || '').localeCompare(String(b.numeroRevisao || '')))
  }

  try {
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
  } catch (err) {
    if (!isPermissionError(err)) throw err
    mockMode = true
    return readMockRevisoes().filter((item) => item.processoId === processoId)
  }
}
