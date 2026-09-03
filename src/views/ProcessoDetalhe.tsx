import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, FileText, Plus } from 'lucide-react'
import type { Processo } from '../models/Processo'
import { nextRevisao } from '../models/Processo'
import {
  getProcessoById,
  listSolicitacoesByProcesso,
} from '../services/processo/processoService'
import { Button, Typography } from '../components/ui'
import './Processos.css'

type RevisaoItem = {
  id: string
  numeroRevisao?: string
  titulo?: string
  status?: string
  analisadoPorIA?: boolean
  checklistConformidade?: string
  parecerTecnico?: string
  createdAt?: { toDate?: () => Date } | Date | string
}

function countPendencias(checklistRaw?: string): { ok: number; naoConforme: number; ausente: number } {
  const empty = { ok: 0, naoConforme: 0, ausente: 0 }
  if (!checklistRaw?.trim()) return empty
  try {
    const parsed = JSON.parse(checklistRaw) as unknown
    if (!Array.isArray(parsed)) return empty
    return parsed.reduce((acc, item) => {
      if (!item || typeof item !== 'object') return acc
      const status = String((item as { status?: unknown }).status || '').toUpperCase()
      if (status === 'OK') acc.ok += 1
      else if (status === 'NAO_CONFORME') acc.naoConforme += 1
      else if (status === 'INFORMACAO_AUSENTE') acc.ausente += 1
      return acc
    }, { ...empty })
  } catch {
    return empty
  }
}

export default function ProcessoDetalhe() {
  const { processoId } = useParams<{ processoId: string }>()
  const navigate = useNavigate()
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [revisoes, setRevisoes] = useState<RevisaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!processoId) return
    try {
      setLoading(true)
      setError(null)
      const [proc, sols] = await Promise.all([
        getProcessoById(processoId),
        listSolicitacoesByProcesso(processoId),
      ])
      if (!proc) {
        setError('Processo não encontrado.')
        setProcesso(null)
        setRevisoes([])
        return
      }
      setProcesso(proc)
      setRevisoes(sols as RevisaoItem[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar processo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [processoId])

  const handleNovaRevisao = () => {
    if (!processo) return
    const numero = nextRevisao(processo.revisaoAtual)
    navigate('/nova-solicitacao', {
      state: {
        processoId: processo.id,
        numeroRevisao: numero,
        clienteId: processo.clienteId,
        clienteNome: processo.clienteNome,
        rodovia: processo.rodovia,
        concessionariaId: processo.concessionariaId,
        nomeConcessionaria: processo.nomeConcessionaria,
        tituloProcesso: processo.titulo,
      },
    })
  }

  const formatDate = (value: RevisaoItem['createdAt']) => {
    if (!value) return '—'
    if (value instanceof Date) return value.toLocaleDateString('pt-BR')
    if (typeof value === 'string') return new Date(value).toLocaleDateString('pt-BR')
    if (typeof value === 'object' && value.toDate) {
      return value.toDate().toLocaleDateString('pt-BR')
    }
    return '—'
  }

  if (loading) {
    return <div className="processos-page"><div className="processos-empty">Carregando...</div></div>
  }

  if (error || !processo) {
    return (
      <div className="processos-page">
        <div className="processos-alert">
          <AlertCircle size={18} />
          <span>{error || 'Processo não encontrado.'}</span>
          <Link to="/processos">Voltar</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="processos-page">
      <button type="button" className="processos-back" onClick={() => navigate('/processos')}>
        <ArrowLeft size={16} /> Voltar aos processos
      </button>

      <div className="processos-header">
        <div>
          <Typography variant="caption">{processo.codigo}</Typography>
          <Typography variant="h1">{processo.titulo}</Typography>
          <Typography variant="muted">
            {[processo.clienteNome, processo.rodovia, processo.nomeConcessionaria]
              .filter(Boolean)
              .join(' · ') || 'Sem metadados adicionais'}
          </Typography>
        </div>
        <Button variant="primary" leftIcon={<Plus size={18} />} onClick={handleNovaRevisao}>
          Nova revisão ({nextRevisao(processo.revisaoAtual)})
        </Button>
      </div>

      <section className="processos-detail-panel">
        <div className="processos-detail-head">
          <Typography variant="h3">Comparativo de revisões</Typography>
        </div>
        {revisoes.length < 2 ? (
          <Typography variant="muted">
            O comparativo aparece quando houver ao menos duas revisões no processo.
          </Typography>
        ) : (
          <div className="processos-comparativo">
            {revisoes.map((item) => {
              const counts = countPendencias(item.checklistConformidade)
              return (
                <div key={`cmp-${item.id}`} className="processos-comparativo-card">
                  <strong>{item.numeroRevisao || '—'}</strong>
                  <span>OK: {counts.ok}</span>
                  <span>Não conforme: {counts.naoConforme}</span>
                  <span>Ausente: {counts.ausente}</span>
                  <span className="processos-meta">
                    {item.parecerTecnico ? 'Com parecer' : 'Sem parecer'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="processos-detail-panel">
        <div className="processos-detail-head">
          <Typography variant="h3">Histórico de revisões</Typography>
          <span className="processos-rev">Atual: {processo.revisaoAtual}</span>
        </div>

        {revisoes.length === 0 ? (
          <div className="processos-empty">
            <FileText size={36} />
            <Typography variant="body">
              Ainda não há solicitações neste processo. Registre a R00.
            </Typography>
            <Button
              variant="secondary"
              onClick={() =>
                navigate('/nova-solicitacao', {
                  state: {
                    processoId: processo.id,
                    numeroRevisao: 'R00',
                    clienteId: processo.clienteId,
                    clienteNome: processo.clienteNome,
                    rodovia: processo.rodovia,
                    tituloProcesso: processo.titulo,
                  },
                })
              }
            >
              Abrir R00
            </Button>
          </div>
        ) : (
          <ul className="processos-revisoes">
            {revisoes.map((item) => (
              <li key={item.id}>
                <Link to="/solicitacoes" state={{ abrirAnaliseId: item.id }} className="processos-revisao-link">
                  <div>
                    <strong>{item.numeroRevisao || 'Revisão'}</strong>
                    <span>{item.titulo || 'Solicitação'}</span>
                    <span className="processos-meta">{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="processos-revisao-side">
                    <span className={`processos-status status-${item.status || 'pendente'}`}>
                      {item.status || 'pendente'}
                    </span>
                    {item.analisadoPorIA && <span className="processos-ai">IA</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
