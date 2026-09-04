import {
  collection,
  getDocs,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { AnaliseVersao } from '../../models/AnaliseVersao'

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

const parse = (id: string, raw: Record<string, unknown>): AnaliseVersao => ({
  id,
  solicitacaoId: String(raw.solicitacaoId ?? ''),
  versao: typeof raw.versao === 'number' ? raw.versao : Number(raw.versao) || 0,
  jobId: raw.jobId != null ? String(raw.jobId) : null,
  tipoAnaliseId: raw.tipoAnaliseId != null ? String(raw.tipoAnaliseId) : null,
  tipoRelatorio: raw.tipoRelatorio != null ? String(raw.tipoRelatorio) : null,
  parecerTecnico: raw.parecerTecnico != null ? String(raw.parecerTecnico) : null,
  checklistConformidade:
    raw.checklistConformidade != null ? String(raw.checklistConformidade) : null,
  relatorioIA: raw.relatorioIA != null ? String(raw.relatorioIA) : null,
  promptCustomizado: raw.promptCustomizado != null ? String(raw.promptCustomizado) : null,
  createdAt: toDate(raw.createdAt),
})

export async function listAnaliseVersoes(solicitacaoId: string): Promise<AnaliseVersao[]> {
  try {
    const ref = collection(db, 'solicitacoes', solicitacaoId, 'analiseVersoes')
    const snap = await getDocs(query(ref, orderBy('versao', 'desc')))
    return snap.docs.map((item) => parse(item.id, item.data() as Record<string, unknown>))
  } catch (err) {
    if (isPermissionError(err)) return []
    console.warn('Não foi possível listar versões de análise:', err)
    return []
  }
}
