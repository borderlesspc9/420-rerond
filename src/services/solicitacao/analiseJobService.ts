import {
  doc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import type { EscopoAnalise } from '../../models/Solicitacao'
import {
  type AnaliseJob,
  type AnaliseJobState,
  TERMINAL_JOB_STATES,
} from '../../models/AnaliseJob'

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

const parseJob = (
  solicitacaoId: string,
  jobId: string,
  raw: Record<string, unknown>,
): AnaliseJob => ({
  id: jobId,
  solicitacaoId,
  state: (raw.state as AnaliseJobState) ?? 'queued',
  progress: typeof raw.progress === 'number' ? raw.progress : 0,
  stage: raw.stage ? String(raw.stage) : undefined,
  error: raw.error
    ? {
        code: String((raw.error as Record<string, unknown>).code ?? 'unknown'),
        message: String((raw.error as Record<string, unknown>).message ?? 'Erro desconhecido'),
      }
    : null,
  promptCustomizado: raw.promptCustomizado ? String(raw.promptCustomizado) : null,
  tiposProjetoPraComparar: Array.isArray(raw.tiposProjetoPraComparar)
    ? raw.tiposProjetoPraComparar.map(String)
    : undefined,
  escopoAnalise: raw.escopoAnalise as AnaliseJob['escopoAnalise'],
  createdBy: raw.createdBy ? String(raw.createdBy) : null,
  createdAt: toDate(raw.createdAt),
  startedAt: toDate(raw.startedAt),
  completedAt: toDate(raw.completedAt),
  updatedAt: toDate(raw.updatedAt),
})

export async function enqueueAnaliseJob(params: {
  solicitacaoId: string
  promptCustomizado?: string
  tiposProjetoPraComparar?: string[]
  escopoAnalise?: EscopoAnalise
}): Promise<{ jobId: string; solicitacaoId: string }> {
  const callable = httpsCallable(functions, 'analisarSolicitacao', {
    timeout: 60000,
  })

  const response = await callable({
    solicitacaoId: params.solicitacaoId,
    promptCustomizado: params.promptCustomizado,
    tiposProjetoPraComparar: params.tiposProjetoPraComparar,
    escopoAnalise: params.escopoAnalise,
  })

  const data = response.data as { jobId?: string; solicitacaoId?: string } | undefined
  if (!data?.jobId || !data?.solicitacaoId) {
    throw new Error('Resposta inválida ao enfileirar análise.')
  }

  return { jobId: data.jobId, solicitacaoId: data.solicitacaoId }
}

export function subscribeAnaliseJob(
  solicitacaoId: string,
  jobId: string,
  onChange: (job: AnaliseJob) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = doc(db, 'solicitacoes', solicitacaoId, 'analiseJobs', jobId)

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return
      onChange(parseJob(solicitacaoId, snap.id, snap.data() as Record<string, unknown>))
    },
    (error) => {
      console.error('Erro ao acompanhar job de análise:', error)
      onError?.(error)
    },
  )
}

export function waitForAnaliseJob(
  solicitacaoId: string,
  jobId: string,
): Promise<AnaliseJob> {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeAnaliseJob(
      solicitacaoId,
      jobId,
      (job) => {
        if (TERMINAL_JOB_STATES.includes(job.state)) {
          unsubscribe()
          if (job.state === 'failed') {
            reject(new Error(job.error?.message ?? 'A análise falhou.'))
            return
          }
          resolve(job)
        }
      },
      (error) => {
        unsubscribe()
        reject(error)
      },
    )
  })
}
