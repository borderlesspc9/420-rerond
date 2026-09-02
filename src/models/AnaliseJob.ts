export type AnaliseJobState =
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'generating_report'
  | 'completed'
  | 'failed'

export type AnaliseJobError = {
  code: string
  message: string
}

export type AnaliseJob = {
  id: string
  solicitacaoId: string
  state: AnaliseJobState
  progress: number
  stage?: string
  error?: AnaliseJobError | null
  promptCustomizado?: string | null
  tiposProjetoPraComparar?: string[]
  escopoAnalise?: {
    incluirDadosFormulario: boolean
    incluirDocumentosProjeto: boolean
    gerarChecklistConformidade: boolean
    gerarParecerTecnico: boolean
  }
  createdBy?: string | null
  createdAt?: Date
  startedAt?: Date
  completedAt?: Date
  updatedAt?: Date
}

export const TERMINAL_JOB_STATES: AnaliseJobState[] = ['completed', 'failed']

export const ACTIVE_JOB_STATES: AnaliseJobState[] = [
  'uploaded',
  'queued',
  'extracting',
  'analyzing',
  'generating_report',
]

export const JOB_STATE_PROGRESS: Record<AnaliseJobState, number> = {
  uploaded: 8,
  queued: 12,
  extracting: 35,
  analyzing: 62,
  generating_report: 88,
  completed: 100,
  failed: 0,
}

export const JOB_STATE_LABELS: Record<AnaliseJobState, string> = {
  uploaded: 'Documentos recebidos',
  queued: 'Na fila de processamento',
  extracting: 'Extraindo documentos do projeto',
  analyzing: 'Analisando conformidade com IA',
  generating_report: 'Gerando relatório técnico',
  completed: 'Análise concluída',
  failed: 'Falha na análise',
}

export function isActiveJobState(state?: AnaliseJobState | null): boolean {
  return Boolean(state && ACTIVE_JOB_STATES.includes(state))
}

export function mapJobStateToOverlayStage(state: AnaliseJobState): string {
  switch (state) {
    case 'uploaded':
    case 'queued':
      return 'prep'
    case 'extracting':
      return 'pdfs'
    case 'analyzing':
      return 'checklist'
    case 'generating_report':
      return 'parecer'
    case 'completed':
      return 'final'
    case 'failed':
      return 'prep'
    default:
      return 'prep'
  }
}
