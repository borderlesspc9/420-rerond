import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, FileText, MapPin, Calendar, AlertCircle, Sparkles, Eye, CheckCircle, XCircle } from 'lucide-react'
import { getAllSolicitacoes, analisarSolicitacaoComIA, updateSolicitacao } from '../services/solicitacao/solicitacaoService'
import type { SolicitacaoWithFiles } from '../models/Solicitacao.js'
import RelatorioViewer from '../components/RelatorioViewer'
import ModalReanalise from '../components/ModalReanalise'
import './Solicitacoes.css'

export default function Solicitacoes() {
  const navigate = useNavigate()
  const location = useLocation()
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoWithFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [relatorioAberto, setRelatorioAberto] = useState<{
    relatorio: string
    titulo: string
    solicitacaoInfo?: { localizacao?: string; tipoObra?: string; descricao?: string }
  } | null>(null)
  const [modalReanaliseAberto, setModalReanaliseAberto] = useState<SolicitacaoWithFiles | null>(null)
  const [analisandoId, setAnalisandoId] = useState<string | null>(null)
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null)

  useEffect(() => {
    loadSolicitacoes()
  }, [])

  const locationState = location.state as { abrirAnaliseId?: string; filtroStatus?: string } | null
  const abrirAnaliseId = locationState?.abrirAnaliseId
  const filtroStatusInicial = locationState?.filtroStatus

  useEffect(() => {
    if (!abrirAnaliseId || solicitacoes.length === 0) return
    const sol = solicitacoes.find(s => s.id === abrirAnaliseId)
    if (sol) {
      setModalReanaliseAberto(sol)
      navigate(location.pathname, { replace: true, state: filtroStatusInicial ? { filtroStatus: filtroStatusInicial } : {} })
    }
  }, [abrirAnaliseId, solicitacoes, navigate, location.pathname, filtroStatusInicial])

  const loadSolicitacoes = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAllSolicitacoes()
      setSolicitacoes(data)
    } catch (err: any) {
      console.error('Erro ao carregar solicitações:', err)
      setError(err.message || 'Erro ao carregar solicitações. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'aprovada':
        return '#10b981' // verde
      case 'rejeitada':
        return '#ef4444' // vermelho
      case 'em_analise':
        return '#f59e0b' // amarelo
      default:
        return '#6b7280' // cinza
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'aprovada':
        return 'Aprovada'
      case 'rejeitada':
        return 'Rejeitada'
      case 'em_analise':
        return 'Em Análise'
      default:
        return 'Pendente'
    }
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTipoObraLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      duplicacao: 'Duplicação',
      recapeamento: 'Recapeamento',
      reforma: 'Reforma',
      construcao: 'Construção',
      manutencao: 'Manutenção',
    }
    return tipos[tipo] || tipo
  }

  const handleVerRelatorio = (solicitacao: SolicitacaoWithFiles) => {
    if (solicitacao.relatorioIA) {
      setRelatorioAberto({
        relatorio: solicitacao.relatorioIA,
        titulo: solicitacao.titulo,
        solicitacaoInfo: {
          localizacao: solicitacao.localizacao,
          tipoObra: solicitacao.tipoObra,
          descricao: solicitacao.descricao,
        },
      })
    }
  }

  const handleReanalisar = async (
    promptCustomizado?: string,
    novosPDFs?: File[],
    tiposProjetoPraComparar?: string[]
  ) => {
    if (!modalReanaliseAberto?.id) return

    setAnalisandoId(modalReanaliseAberto.id)
    try {
      const resultado = await analisarSolicitacaoComIA(
        modalReanaliseAberto.id, 
        promptCustomizado,
        novosPDFs,
        tiposProjetoPraComparar
      )
      
      // Atualizar a solicitação na lista
      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === resultado.id ? resultado : s))
      )
      
      // Mostrar o novo relatório
      if (resultado.relatorioIA) {
        setRelatorioAberto({
          relatorio: resultado.relatorioIA,
          titulo: resultado.titulo,
          solicitacaoInfo: {
            localizacao: resultado.localizacao,
            tipoObra: resultado.tipoObra,
            descricao: resultado.descricao,
          },
        })
      }
      
      setModalReanaliseAberto(null)
    } catch (error: any) {
      console.error('Erro ao analisar:', error)
      throw error
    } finally {
      setAnalisandoId(null)
    }
  }

  const handleAprovar = async (solicitacao: SolicitacaoWithFiles) => {
    if (!solicitacao.id) return

    setAprovandoId(solicitacao.id)
    try {
      const resultado = await updateSolicitacao(solicitacao.id, {
        status: 'aprovada',
      })
      
      // Atualizar a solicitação na lista
      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === resultado.id ? resultado : s))
      )
    } catch (error: any) {
      console.error('Erro ao aprovar solicitação:', error)
      alert('Erro ao aprovar solicitação: ' + (error.message || 'Tente novamente'))
    } finally {
      setAprovandoId(null)
    }
  }

  const handleRejeitar = async (solicitacao: SolicitacaoWithFiles) => {
    if (!solicitacao.id) return

    setRejeitandoId(solicitacao.id)
    try {
      const resultado = await updateSolicitacao(solicitacao.id, {
        status: 'rejeitada',
      })
      
      // Atualizar a solicitação na lista
      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === resultado.id ? resultado : s))
      )
    } catch (error: any) {
      console.error('Erro ao rejeitar solicitação:', error)
      alert('Erro ao rejeitar solicitação: ' + (error.message || 'Tente novamente'))
    } finally {
      setRejeitandoId(null)
    }
  }

  if (loading) {
    return (
      <div className="solicitacoes-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando solicitações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="solicitacoes-container">
      <div className="solicitacoes-header">
        <h1>Solicitações</h1>
        <button
          className="btn-nova-solicitacao"
          onClick={() => navigate('/nova-solicitacao')}
        >
          <Plus size={20} />
          Nova Solicitação
        </button>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={loadSolicitacoes} className="btn-retry">
            Tentar Novamente
          </button>
        </div>
      )}

      {solicitacoes.length === 0 && !error ? (
        <div className="empty-state">
          <FileText size={48} />
          <h2>Nenhuma solicitação encontrada</h2>
          <p>Comece criando sua primeira solicitação</p>
          <button
            className="btn-nova-solicitacao"
            onClick={() => navigate('/nova-solicitacao')}
          >
            <Plus size={20} />
            Criar Primeira Solicitação
          </button>
        </div>
      ) : (
        <div className="solicitacoes-grid">
          {solicitacoes.map((solicitacao) => (
            <div key={solicitacao.id} className="solicitacao-card">
              <div className="solicitacao-header">
                <h3>{solicitacao.titulo}</h3>
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(solicitacao.status) }}
                >
                  {getStatusLabel(solicitacao.status)}
                </span>
              </div>

              <div className="solicitacao-info">
                <div className="info-item">
                  <FileText size={16} />
                  <span>{getTipoObraLabel(solicitacao.tipoObra)}</span>
                </div>
                <div className="info-item">
                  <MapPin size={16} />
                  <span>{solicitacao.localizacao}</span>
                </div>
                <div className="info-item">
                  <Calendar size={16} />
                  <span>{formatDate(solicitacao.createdAt)}</span>
                </div>
              </div>

              <p className="solicitacao-descricao">{solicitacao.descricao}</p>

              {solicitacao.arquivos && solicitacao.arquivos.length > 0 && (
                <div className="arquivos-count">
                  {solicitacao.arquivos.length} arquivo(s) anexado(s)
                </div>
              )}

              {solicitacao.analisadoPorIA && (
                <div className="solicitacao-ia-badge">
                  <Sparkles size={14} />
                  <span>Analisado por IA</span>
                  {solicitacao.analisadoEm && (
                    <span className="ia-date">
                      {formatDate(solicitacao.analisadoEm)}
                    </span>
                  )}
                </div>
              )}

              <div className="solicitacao-actions">
                {solicitacao.relatorioIA && (
                  <button
                    className="btn-ver-relatorio"
                    onClick={() => handleVerRelatorio(solicitacao)}
                  >
                    <Eye size={16} />
                    Ver Relatório
                  </button>
                )}
                <button
                  className="btn-reanalisar"
                  onClick={() => setModalReanaliseAberto(solicitacao)}
                  disabled={analisandoId === solicitacao.id}
                >
                  <Sparkles size={16} />
                  {analisandoId === solicitacao.id 
                    ? 'Analisando...' 
                    : solicitacao.analisadoPorIA 
                      ? 'Reanalisar' 
                      : 'Primeira Análise'}
                </button>
                {solicitacao.analisadoPorIA && solicitacao.status !== 'aprovada' && solicitacao.status !== 'rejeitada' && (
                  <>
                    <button
                      className="btn-aprovar"
                      onClick={() => handleAprovar(solicitacao)}
                      disabled={aprovandoId === solicitacao.id || rejeitandoId === solicitacao.id}
                      title="Aprovar solicitação após análise de IA"
                    >
                      <CheckCircle size={16} />
                      {aprovandoId === solicitacao.id ? 'Aprovando...' : 'Aprovar'}
                    </button>
                    <button
                      className="btn-rejeitar"
                      onClick={() => handleRejeitar(solicitacao)}
                      disabled={aprovandoId === solicitacao.id || rejeitandoId === solicitacao.id}
                      title="Rejeitar solicitação após análise de IA"
                    >
                      <XCircle size={16} />
                      {rejeitandoId === solicitacao.id ? 'Rejeitando...' : 'Rejeitar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {relatorioAberto && (
        <RelatorioViewer
          relatorio={relatorioAberto.relatorio}
          titulo={relatorioAberto.titulo}
          solicitacaoInfo={relatorioAberto.solicitacaoInfo}
          onClose={() => setRelatorioAberto(null)}
        />
      )}

      {modalReanaliseAberto && (
        <ModalReanalise
          titulo={modalReanaliseAberto.titulo}
          tipoObraAtual={modalReanaliseAberto.tipoObra}
          primeiraAnalise={!modalReanaliseAberto.analisadoPorIA}
          onConfirm={handleReanalisar}
          onClose={() => setModalReanaliseAberto(null)}
        />
      )}
    </div>
  )
}
