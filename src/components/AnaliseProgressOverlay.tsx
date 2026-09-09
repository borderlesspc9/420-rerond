import { useEffect, useMemo, useState } from 'react'
import { FileSearch, FileText, Scale, Sparkles, CheckCircle2 } from 'lucide-react'
import {
  type AnaliseJobState,
  JOB_STATE_LABELS,
  mapJobStateToOverlayStage,
} from '../models/AnaliseJob'
import './AnaliseProgressOverlay.css'

export type AnaliseProgressOverlayProps = {
  active: boolean
  titulo?: string
  nomeConcessionaria?: string | null
  concessionariaId?: string | null
  jobState?: AnaliseJobState | null
  progress?: number | null
  errorMessage?: string | null
}

type Stage = {
  id: string
  label: string
  detail: string
  targetPercent: number
  icon: 'docs' | 'normas' | 'pdf' | 'checklist' | 'parecer' | 'done'
}

const STAGES: Stage[] = [
  {
    id: 'prep',
    label: 'Preparando análise',
    detail: 'Validando escopo e metadados da solicitação',
    targetPercent: 12,
    icon: 'docs',
  },
  {
    id: 'normas',
    label: 'Carregando normas de referência',
    detail: 'ANTT/SUROD e diretrizes da concessionária',
    targetPercent: 28,
    icon: 'normas',
  },
  {
    id: 'pdfs',
    label: 'Extraindo documentos do projeto',
    detail: 'Lendo e preparando PDFs para análise',
    targetPercent: 48,
    icon: 'pdf',
  },
  {
    id: 'checklist',
    label: 'Analisando conformidade',
    detail: 'Avaliando checklist item a item com IA',
    targetPercent: 72,
    icon: 'checklist',
  },
  {
    id: 'parecer',
    label: 'Gerando relatório técnico',
    detail: 'Montando parecer no formato da concessionária',
    targetPercent: 90,
    icon: 'parecer',
  },
  {
    id: 'final',
    label: 'Finalizando',
    detail: 'Consolidando checklist, conferência e conclusão',
    targetPercent: 97,
    icon: 'done',
  },
]

function StageIcon({ kind, active }: { kind: Stage['icon']; active: boolean }) {
  const props = { size: 18, strokeWidth: 2.2 }
  const className = active ? 'apo-stage-icon apo-stage-icon-active' : 'apo-stage-icon'
  switch (kind) {
    case 'docs':
      return <FileText {...props} className={className} />
    case 'normas':
      return <Scale {...props} className={className} />
    case 'pdf':
      return <FileSearch {...props} className={className} />
    case 'checklist':
      return <CheckCircle2 {...props} className={className} />
    case 'parecer':
      return <Sparkles {...props} className={className} />
    default:
      return <CheckCircle2 {...props} className={className} />
  }
}

export default function AnaliseProgressOverlay({
  active,
  titulo,
  nomeConcessionaria,
  concessionariaId,
  jobState,
  progress,
  errorMessage,
}: AnaliseProgressOverlayProps) {
  const [simulatedPercent, setSimulatedPercent] = useState(0)
  const [simulatedStageIndex, setSimulatedStageIndex] = useState(0)
  const usesRealJob = Boolean(jobState)

  const concessionariaLabel = useMemo(() => {
    if (nomeConcessionaria?.trim()) return nomeConcessionaria.trim()
    if (concessionariaId === 'eco101') return 'Ecovias / ECO101'
    if (concessionariaId === 'motiva') return 'Motiva'
    if (concessionariaId === 'arteris') return 'Arteris'
    return 'Concessionária'
  }, [nomeConcessionaria, concessionariaId])

  const stageIndex = useMemo(() => {
    if (!jobState) return simulatedStageIndex
    const stageId = mapJobStateToOverlayStage(jobState)
    const idx = STAGES.findIndex((stage) => stage.id === stageId)
    return idx >= 0 ? idx : simulatedStageIndex
  }, [jobState, simulatedStageIndex])

  const displayPercent = useMemo(() => {
    if (jobState === 'failed') return 0
    if (jobState === 'completed') return 100
    if (typeof progress === 'number' && progress > 0) return Math.round(progress)
    return Math.round(simulatedPercent)
  }, [jobState, progress, simulatedPercent])

  const current = STAGES[Math.min(stageIndex, STAGES.length - 1)]

  useEffect(() => {
    if (!active || usesRealJob) {
      setSimulatedPercent(0)
      setSimulatedStageIndex(0)
      return
    }

    setSimulatedPercent(3)
    setSimulatedStageIndex(0)

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      let next = 3
      if (elapsed < 4000) next = 3 + (elapsed / 4000) * 20
      else if (elapsed < 12000) next = 23 + ((elapsed - 4000) / 8000) * 27
      else if (elapsed < 28000) next = 50 + ((elapsed - 12000) / 16000) * 28
      else if (elapsed < 55000) next = 78 + ((elapsed - 28000) / 27000) * 14
      else next = 92 + Math.min(5, ((elapsed - 55000) / 60000) * 5)

      setSimulatedPercent((prev) => Math.max(prev, Math.min(97, next)))

      const idx = STAGES.findIndex((s) => next < s.targetPercent)
      setSimulatedStageIndex(idx === -1 ? STAGES.length - 1 : Math.max(0, idx))
    }, 200)

    return () => window.clearInterval(timer)
  }, [active, usesRealJob])

  if (!active) return null

  const currentLabel = jobState ? JOB_STATE_LABELS[jobState] : current.label
  const currentDetail = jobState === 'failed'
    ? errorMessage ?? 'Ocorreu um erro durante o processamento.'
    : current.detail

  return (
    <div className="apo-overlay" role="alertdialog" aria-modal="true" aria-labelledby="apo-title">
      <div className="apo-card">
        <div className="apo-brand-row">
          <img src="/logo420.png" alt="BaseInfra" className="apo-brand-logo" />
          <span className="apo-brand-badge">Análise por IA</span>
        </div>

        <h2 id="apo-title" className="apo-title">
          {jobState === 'failed' ? 'Falha na análise' : 'Gerando relatório técnico'}
        </h2>
        <p className="apo-subtitle">
          {titulo ? (
            <>
              Processando <strong>{titulo}</strong>
            </>
          ) : (
            'Processando a solicitação'
          )}
          {' · '}
          <span className="apo-concessionaria">{concessionariaLabel}</span>
        </p>

        <div className="apo-percent-block" aria-live="polite">
          <div className="apo-percent">{displayPercent}%</div>
          <div className="apo-current-stage">
            <StageIcon kind={current.icon} active />
            <div>
              <div className="apo-current-label">{currentLabel}</div>
              <div className="apo-current-detail">{currentDetail}</div>
            </div>
          </div>
        </div>

        <div
          className="apo-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPercent}
          aria-label="Progresso da análise"
        >
          <div className="apo-bar-fill" style={{ width: `${displayPercent}%` }} />
          <div className="apo-bar-glow" style={{ left: `calc(${displayPercent}% - 12px)` }} />
        </div>

        <ol className="apo-stages">
          {STAGES.map((stage, index) => {
            const done = index < stageIndex
            const currentStage = index === stageIndex
            return (
              <li
                key={stage.id}
                className={[
                  'apo-stage',
                  done ? 'apo-stage-done' : '',
                  currentStage ? 'apo-stage-current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="apo-stage-marker">
                  {done ? <CheckCircle2 size={16} /> : <StageIcon kind={stage.icon} active={currentStage} />}
                </span>
                <span className="apo-stage-text">{stage.label}</span>
              </li>
            )
          })}
        </ol>

        <p className="apo-hint">
          {jobState === 'failed'
            ? 'Edite a solicitação para ajustar PDFs se necessário e use Tentar novamente na mesma ficha — não é preciso abrir um processo novo.'
            : usesRealJob
              ? 'A análise continua em segundo plano. Você pode navegar pelo sistema enquanto processamos os documentos.'
              : 'A análise pode levar alguns minutos conforme o volume de PDFs.'}
        </p>
      </div>
    </div>
  )
}
