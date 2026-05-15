import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import type { EscopoAnalise, Solicitacao, SolicitacaoWithFiles } from '../../models/Solicitacao'
import { auth, db, functions, storage } from '../../lib/firebase'

const COLLECTION_NAME =
  import.meta.env.VITE_FIRESTORE_SOLICITACOES_COLLECTION?.trim() || 'solicitacoes'

const solicitacoesRef = collection(db, COLLECTION_NAME)

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return undefined
}

const parseArquivos = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item))
      }
    } catch {
      return [value]
    }
  }
  return []
}

const mapSolicitacao = (id: string, data: DocumentData): SolicitacaoWithFiles => {
  const arquivos = parseArquivos(data.arquivos)

  return {
    id,
    titulo: String(data.titulo ?? ''),
    tipoObra: String(data.tipoObra ?? ''),
    localizacao: String(data.localizacao ?? ''),
    descricao: String(data.descricao ?? ''),
    status: (data.status as Solicitacao['status']) ?? 'pendente',
    relatorioIA: data.relatorioIA ? String(data.relatorioIA) : undefined,
    analisadoPorIA: Boolean(data.analisadoPorIA),
    analisadoEm: toDate(data.analisadoEm),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    cliente: data.cliente ? String(data.cliente) : undefined,
    kilometragem: data.kilometragem ? String(data.kilometragem) : undefined,
    nroProcessoErp: data.nroProcessoErp ? String(data.nroProcessoErp) : undefined,
    rodovia: data.rodovia ? String(data.rodovia) : undefined,
    nomeConcessionaria: data.nomeConcessionaria ? String(data.nomeConcessionaria) : undefined,
    sentido: data.sentido ? String(data.sentido) : undefined,
    ocupacao: data.ocupacao ? String(data.ocupacao) : undefined,
    municipioEstado: data.municipioEstado ? String(data.municipioEstado) : undefined,
    ocupacaoArea: data.ocupacaoArea ? String(data.ocupacaoArea) : undefined,
    responsavelTecnico: data.responsavelTecnico ? String(data.responsavelTecnico) : undefined,
    faseProjeto: data.faseProjeto ? String(data.faseProjeto) : undefined,
    analistaResponsavel: data.analistaResponsavel
      ? String(data.analistaResponsavel)
      : undefined,
    memorial: data.memorial ? String(data.memorial) : undefined,
    dataRecebimento: data.dataRecebimento ? String(data.dataRecebimento) : undefined,
    numeroRevisao: data.numeroRevisao ? String(data.numeroRevisao) : undefined,
    tipoRelatorio: data.tipoRelatorio ? (data.tipoRelatorio as Solicitacao['tipoRelatorio']) : undefined,
    parecerTecnico: data.parecerTecnico ? String(data.parecerTecnico) : undefined,
    checklistConformidade: data.checklistConformidade ? String(data.checklistConformidade) : undefined,
    arquivos,
    arquivosUrls: arquivos,
  }
}

const ensureAuthenticatedUpload = async () => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente antes de enviar arquivos.')
  }

  await user.getIdToken()
}

const formatStorageUploadError = (error: unknown): string => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : ''

  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return 'Sem permissão para enviar arquivos. Faça login novamente e tente outra vez.'
  }

  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return 'Não foi possível enviar os arquivos para o Firebase Storage. Verifique se o Storage está ativo no projeto Firebase e se as regras foram publicadas.'
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Não foi possível enviar os arquivos para o Firebase Storage.'
}

const uploadSolicitacaoFiles = async (solicitacaoId: string, files: File[]) => {
  await ensureAuthenticatedUpload()

  const uploads = files.map(async (file) => {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const storageRef = ref(
      storage,
      `solicitacoes/${solicitacaoId}/${Date.now()}-${safeName}`,
    )

    try {
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || undefined,
      })
      return getDownloadURL(snapshot.ref)
    } catch (error: unknown) {
      throw new Error(formatStorageUploadError(error))
    }
  })

  return Promise.all(uploads)
}

const buildCreatePayload = (
  solicitacao: Omit<Solicitacao, 'id' | 'createdAt' | 'updatedAt'>,
) => ({
  titulo: solicitacao.titulo,
  tipoObra: solicitacao.tipoObra,
  localizacao: solicitacao.localizacao,
  descricao: solicitacao.descricao,
  status: solicitacao.status ?? 'pendente',
  relatorioIA: solicitacao.relatorioIA ?? null,
  analisadoPorIA: solicitacao.analisadoPorIA ?? false,
  analisadoEm: solicitacao.analisadoEm ?? null,
  createdBy: solicitacao.createdBy ?? auth.currentUser?.uid ?? null,
  cliente: solicitacao.cliente ?? null,
  kilometragem: solicitacao.kilometragem ?? null,
  nroProcessoErp: solicitacao.nroProcessoErp ?? null,
  rodovia: solicitacao.rodovia ?? null,
  nomeConcessionaria: solicitacao.nomeConcessionaria ?? null,
  sentido: solicitacao.sentido ?? null,
  ocupacao: solicitacao.ocupacao ?? null,
  municipioEstado: solicitacao.municipioEstado ?? null,
  ocupacaoArea: solicitacao.ocupacaoArea ?? null,
  responsavelTecnico: solicitacao.responsavelTecnico ?? null,
  faseProjeto: solicitacao.faseProjeto ?? null,
  analistaResponsavel: solicitacao.analistaResponsavel ?? null,
  memorial: solicitacao.memorial ?? null,
  dataRecebimento: solicitacao.dataRecebimento ?? null,
  numeroRevisao: solicitacao.numeroRevisao ?? null,
  tipoRelatorio: solicitacao.tipoRelatorio ?? null,
  parecerTecnico: solicitacao.parecerTecnico ?? null,
  checklistConformidade: solicitacao.checklistConformidade ?? null,
  arquivos: [],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})

export const createSolicitacao = async (
  solicitacao: Omit<Solicitacao, 'id' | 'createdAt' | 'updatedAt'>,
  files: File[] = [],
): Promise<string> => {
  let createdId: string | null = null

  try {
    const created = await addDoc(solicitacoesRef, buildCreatePayload(solicitacao))
    createdId = created.id

    if (files.length === 0) {
      return created.id
    }

    const arquivos = await uploadSolicitacaoFiles(created.id, files)
    await updateDoc(doc(db, COLLECTION_NAME, created.id), {
      arquivos,
      updatedAt: serverTimestamp(),
    })

    return created.id
  } catch (error: unknown) {
    if (createdId) {
      try {
        await deleteDoc(doc(db, COLLECTION_NAME, createdId))
      } catch (rollbackError: unknown) {
        console.error('Erro ao reverter solicitação sem anexos:', rollbackError)
      }
    }

    console.error('Erro ao criar solicitação:', error)
    const message = error instanceof Error ? error.message : 'Erro ao criar solicitação.'
    throw new Error(message)
  }
}

export const getAllSolicitacoes = async (): Promise<SolicitacaoWithFiles[]> => {
  try {
    const snapshot = await getDocs(query(solicitacoesRef, orderBy('createdAt', 'desc')))
    return snapshot.docs.map((item) => mapSolicitacao(item.id, item.data()))
  } catch (error: unknown) {
    console.error('Erro ao buscar solicitações:', error)
    const message = error instanceof Error ? error.message : 'Erro ao buscar solicitações.'
    throw new Error(message)
  }
}

export const getSolicitacaoById = async (id: string): Promise<SolicitacaoWithFiles | null> => {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id))
    if (!snapshot.exists()) {
      return null
    }

    return mapSolicitacao(snapshot.id, snapshot.data())
  } catch (error: unknown) {
    console.error('Erro ao buscar solicitação:', error)
    throw new Error('Erro ao buscar solicitação. Tente novamente.')
  }
}

export const updateSolicitacao = async (
  id: string,
  updates: Partial<Solicitacao>,
): Promise<SolicitacaoWithFiles> => {
  try {
    const refDoc = doc(db, COLLECTION_NAME, id)
    const existing = await getDoc(refDoc)
    if (!existing.exists()) {
      throw new Error('Solicitação não encontrada')
    }

    const payload: Record<string, unknown> = {
      ...updates,
      updatedAt: serverTimestamp(),
    }

    if (updates.arquivos) {
      payload.arquivos = updates.arquivos
    }

    await updateDoc(refDoc, payload)
    const updated = await getDoc(refDoc)
    return mapSolicitacao(updated.id, updated.data() ?? {})
  } catch (error: unknown) {
    console.error('Erro ao atualizar solicitação:', error)
    const message = error instanceof Error ? error.message : 'Erro ao atualizar solicitação.'
    throw new Error(message)
  }
}

export const deleteSolicitacao = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id))
  } catch (error: unknown) {
    console.error('Erro ao deletar solicitação:', error)
    const message = error instanceof Error ? error.message : 'Erro ao deletar solicitação.'
    throw new Error(message)
  }
}

export const analisarSolicitacaoComIA = async (
  id: string,
  promptCustomizado?: string,
  novosPDFs?: File[],
  tiposProjetoPraComparar?: string[],
  escopoAnalise?: EscopoAnalise,
): Promise<SolicitacaoWithFiles> => {
  try {
    const callable = httpsCallable(functions, 'analisarSolicitacao', {
      // A análise com PDF + norma pode levar alguns minutos.
      timeout: 540000,
    })
    const response = await callable({
      solicitacaoId: id,
      promptCustomizado,
      tiposProjetoPraComparar,
      escopoAnalise,
      novosPDFsCount: novosPDFs?.length ?? 0,
    })

    const data = response.data as SolicitacaoWithFiles | undefined
    if (!data?.id) {
      throw new Error('Resposta inválida da Cloud Function de análise.')
    }

    return {
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      analisadoEm: toDate(data.analisadoEm),
      arquivos: parseArquivos(data.arquivos),
      arquivosUrls: parseArquivos(data.arquivos),
    }
  } catch (error: unknown) {
    console.error('Erro ao analisar solicitação:', error)
    const firebaseCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : ''
    if (firebaseCode === 'functions/deadline-exceeded') {
      throw new Error(
        'A análise excedeu o tempo limite da chamada. Aguarde e atualize a página para verificar se o relatório foi concluído.',
      )
    }
    const message =
      error instanceof Error
        ? error.message
        : 'A análise por IA estará disponível após o deploy das Cloud Functions.'
    throw new Error(message)
  }
}
