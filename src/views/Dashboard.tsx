import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Plus,
  TrendingUp,
  ArrowRight,
  Zap,
  BarChart3,
  Building2,
} from 'lucide-react'
import { getAllSolicitacoes } from '../services/solicitacao/solicitacaoService'
import {
  addConcessionaria,
  loadConcessionarias,
} from '../utils/concessionariasStorage'
import type { SolicitacaoWithFiles } from '../models/Solicitacao'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoWithFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<
    'todas' | 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada'
  >('todas')
  const [busca, setBusca] = useState('')
  const [showConcessionariaModal, setShowConcessionariaModal] = useState(false)
  const [concessionarias, setConcessionarias] = useState<string[]>(() => loadConcessionarias())
  const [novaConcessionaria, setNovaConcessionaria] = useState('')
  const [concessionariaFeedback, setConcessionariaFeedback] = useState<string | null>(null)

  useEffect(() => {
    loadSolicitacoes()
  }, [])

  const loadSolicitacoes = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAllSolicitacoes()
      setSolicitacoes(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados.'
      console.error('Erro ao carregar solicitações:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const total = solicitacoes.length
  const pendentes = solicitacoes.filter((s) => s.status === 'pendente').length
  const emAnalise = solicitacoes.filter((s) => s.status === 'em_analise').length
  const aprovadas = solicitacoes.filter((s) => s.status === 'aprovada').length
  const rejeitadas = solicitacoes.filter((s) => s.status === 'rejeitada').length
  const analisadasIA = solicitacoes.filter((s) => s.analisadoPorIA).length

  // Estatísticas avançadas
  const totalAnalisadas = aprovadas + rejeitadas
  const taxaAprovacao = totalAnalisadas > 0 
    ? Math.round((aprovadas / totalAnalisadas) * 100) 
    : 0
  
  // Solicitações pendentes há mais de 7 dias
  const hoje = new Date()
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
  const pendentesAntigas = solicitacoes.filter((s) => {
    if (s.status !== 'pendente' || !s.createdAt) return false
    const dataCriacao = new Date(s.createdAt)
    return dataCriacao < seteDiasAtras
  }).length

  // Distribuição para gráfico
  const distribuicaoStatus = [
    { label: 'Aprovadas', valor: aprovadas, cor: '#10b981' },
    { label: 'Em Análise', valor: emAnalise, cor: '#f59e0b' },
    { label: 'Pendentes', valor: pendentes, cor: '#6b7280' },
    { label: 'Rejeitadas', valor: rejeitadas, cor: '#ef4444' },
  ].filter((item) => item.valor > 0)

  const maxValor = Math.max(...distribuicaoStatus.map((d) => d.valor), 1)

  const solicitacoesOrdenadas = [...solicitacoes]
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return db - da
    })

  const solicitacoesFiltradas = solicitacoesOrdenadas
    .filter((s) => (statusFiltro === 'todas' ? true : s.status === statusFiltro))
    .filter((s) => {
      if (!busca.trim()) return true
      const termo = busca.toLowerCase()
      return (
        s.titulo.toLowerCase().includes(termo) ||
        s.localizacao.toLowerCase().includes(termo)
      )
    })
    .slice(0, 5)

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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'aprovada':
        return 'var(--dashboard-status-aprovada)'
      case 'rejeitada':
        return 'var(--dashboard-status-rejeitada)'
      case 'em_analise':
        return 'var(--dashboard-status-em-analise)'
      default:
        return 'var(--dashboard-status-pendente)'
    }
  }

  const openConcessionariaModal = () => {
    setConcessionarias(loadConcessionarias())
    setNovaConcessionaria('')
    setConcessionariaFeedback(null)
    setShowConcessionariaModal(true)
  }

  const closeConcessionariaModal = () => {
    setShowConcessionariaModal(false)
    setNovaConcessionaria('')
    setConcessionariaFeedback(null)
  }

  const handleAddConcessionaria = () => {
    const resultado = addConcessionaria(concessionarias, novaConcessionaria)
    if (!resultado.nome) {
      setConcessionariaFeedback('Informe o nome da concessionária.')
      return
    }

    setConcessionarias(resultado.concessionarias)
    setNovaConcessionaria('')

    if (resultado.added) {
      setConcessionariaFeedback(`Concessionária "${resultado.nome}" cadastrada.`)
      return
    }

    setConcessionariaFeedback(`A concessionária "${resultado.nome}" já está cadastrada.`)
  }

  const handleNovaConcessionariaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleAddConcessionaria()
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Visão geral das solicitações de obras
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            className="dashboard-btn-secundaria"
            onClick={openConcessionariaModal}
          >
            <Building2 size={20} />
            Nova Concessionária
          </button>
          <button
            type="button"
            className="dashboard-btn-nova"
            onClick={() => navigate('/nova-solicitacao')}
          >
            <Plus size={20} />
            Nova Solicitação
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={loadSolicitacoes} className="dashboard-btn-retry">
            Tentar novamente
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="dashboard-cards">
            <div className="dashboard-card dashboard-card-total">
              <div className="dashboard-card-icon">
                <FileText size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{total}</span>
                <span className="dashboard-card-label">Total de Solicitações</span>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-icon dashboard-card-icon-pendente">
                <Clock size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{pendentes}</span>
                <span className="dashboard-card-label">Pendentes</span>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-icon dashboard-card-icon-analise">
                <TrendingUp size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{emAnalise}</span>
                <span className="dashboard-card-label">Em Análise</span>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-icon dashboard-card-icon-aprovada">
                <CheckCircle size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{aprovadas}</span>
                <span className="dashboard-card-label">Aprovadas</span>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-icon dashboard-card-icon-rejeitada">
                <XCircle size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{rejeitadas}</span>
                <span className="dashboard-card-label">Rejeitadas</span>
              </div>
            </div>

            <div className="dashboard-card dashboard-card-ia">
              <div className="dashboard-card-icon dashboard-card-icon-ia">
                <Sparkles size={24} />
              </div>
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{analisadasIA}</span>
                <span className="dashboard-card-label">Analisadas por IA</span>
              </div>
            </div>
          </div>

          {/* Estatísticas Avançadas e Ações Rápidas */}
          <div className="dashboard-grid-actions">
            {/* Gráfico de Distribuição */}
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>
                  <BarChart3 size={20} />
                  Distribuição por Status
                </h2>
              </div>
              {distribuicaoStatus.length > 0 ? (
                <div className="dashboard-chart">
                  {distribuicaoStatus.map((item, index) => (
                    <div key={index} className="dashboard-chart-item">
                      <div className="dashboard-chart-label">
                        <span
                          className="dashboard-chart-dot"
                          style={{ backgroundColor: item.cor }}
                        />
                        <span>{item.label}</span>
                        <span className="dashboard-chart-value">{item.valor}</span>
                      </div>
                      <div className="dashboard-chart-bar-container">
                        <div
                          className="dashboard-chart-bar"
                          style={{
                            width: `${(item.valor / maxValor) * 100}%`,
                            backgroundColor: item.cor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dashboard-chart-empty">Nenhum dado para exibir</p>
              )}
              {totalAnalisadas > 0 && (
                <div className="dashboard-stats-footer">
                  <div className="dashboard-stat-item">
                    <span className="dashboard-stat-label">Taxa de Aprovação</span>
                    <span className="dashboard-stat-value">{taxaAprovacao}%</span>
                  </div>
                  <div className="dashboard-stat-item">
                    <span className="dashboard-stat-label">Total Analisadas</span>
                    <span className="dashboard-stat-value">{totalAnalisadas}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>
                  <Zap size={20} />
                  Ações Rápidas
                </h2>
              </div>
              <div className="dashboard-acoes-rapidas">
                <button
                  className="dashboard-acao-item"
                  onClick={() => navigate('/nova-solicitacao')}
                >
                  <Plus size={20} />
                  <div>
                    <span className="dashboard-acao-titulo">Nova Solicitação</span>
                    <span className="dashboard-acao-desc">Criar nova solicitação</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="dashboard-acao-item"
                  onClick={openConcessionariaModal}
                >
                  <Building2 size={20} />
                  <div>
                    <span className="dashboard-acao-titulo">Nova Concessionária</span>
                    <span className="dashboard-acao-desc">
                      Cadastrar concessionária para novas solicitações
                    </span>
                  </div>
                </button>
                <button
                  className="dashboard-acao-item"
                  onClick={() => navigate('/solicitacoes', { state: { filtroStatus: 'pendente' } })}
                >
                  <Clock size={20} />
                  <div>
                    <span className="dashboard-acao-titulo">Ver Pendentes</span>
                    <span className="dashboard-acao-desc">
                      {pendentes} solicitação(ões) aguardando
                    </span>
                  </div>
                  {pendentesAntigas > 0 && (
                    <span className="dashboard-acao-badge">{pendentesAntigas}</span>
                  )}
                </button>
                <button
                  className="dashboard-acao-item"
                  onClick={() => navigate('/solicitacoes', { state: { filtroStatus: 'em_analise' } })}
                >
                  <TrendingUp size={20} />
                  <div>
                    <span className="dashboard-acao-titulo">Em Análise</span>
                    <span className="dashboard-acao-desc">
                      {emAnalise} solicitação(ões) sendo analisadas
                    </span>
                  </div>
                </button>
                <button
                  className="dashboard-acao-item"
                  onClick={() => navigate('/solicitacoes', { state: { filtroStatus: 'aprovada' } })}
                >
                  <CheckCircle size={20} />
                  <div>
                    <span className="dashboard-acao-titulo">Aprovadas</span>
                    <span className="dashboard-acao-desc">
                      {aprovadas} solicitação(ões) aprovadas
                    </span>
                  </div>
                </button>
              </div>
              {pendentesAntigas > 0 && (
                <div className="dashboard-alerta">
                  <AlertCircle size={18} />
                  <span>
                    {pendentesAntigas} solicitação(ões) pendente(s) há mais de 7 dias
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>Últimas Solicitações</h2>
              <button
                className="dashboard-link-todas"
                onClick={() => navigate('/solicitacoes')}
              >
                Ver todas
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="dashboard-filtros">
              <input
                type="text"
                className="dashboard-input-busca"
                placeholder="Buscar por título ou localização..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <div className="dashboard-filtros-status">
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'pendente', label: 'Pendentes' },
                  { id: 'em_analise', label: 'Em análise' },
                  { id: 'aprovada', label: 'Aprovadas' },
                  { id: 'rejeitada', label: 'Rejeitadas' },
                ].map((filtro) => (
                  <button
                    key={filtro.id}
                    className={`dashboard-chip ${statusFiltro === filtro.id ? 'active' : ''}`}
                    onClick={() =>
                      setStatusFiltro(
                        filtro.id as
                          | 'todas'
                          | 'pendente'
                          | 'em_analise'
                          | 'aprovada'
                          | 'rejeitada'
                      )
                    }
                  >
                    {filtro.label}
                  </button>
                ))}
              </div>
              {(statusFiltro !== 'todas' || busca.trim()) && (
                <button
                  className="dashboard-limpar-filtros"
                  onClick={() => {
                    setStatusFiltro('todas')
                    setBusca('')
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <p className="dashboard-resultados">
              Exibindo {solicitacoesFiltradas.length} de {solicitacoes.length} solicitação(ões)
            </p>

            {solicitacoesFiltradas.length === 0 ? (
              <div className="dashboard-empty">
                <FileText size={40} />
                <p>
                  {solicitacoes.length === 0
                    ? 'Nenhuma solicitação cadastrada'
                    : 'Nenhuma solicitação encontrada com os filtros atuais'}
                </p>
                {solicitacoes.length === 0 && (
                  <button
                    className="dashboard-btn-nova-inline"
                    onClick={() => navigate('/nova-solicitacao')}
                  >
                    Criar primeira solicitação
                  </button>
                )}
              </div>
            ) : (
              <div className="dashboard-list">
                {solicitacoesFiltradas.map((s) => (
                  <div
                    key={s.id}
                    className="dashboard-list-item"
                    onClick={() => navigate('/solicitacoes')}
                  >
                    <div className="dashboard-list-main">
                      <span className="dashboard-list-titulo">
                        {s.titulo}
                      </span>
                      {s.analisadoPorIA && (
                        <span className="dashboard-list-badge-ia">
                          <Sparkles size={12} />
                          IA
                        </span>
                      )}
                    </div>
                    <div className="dashboard-list-meta">
                      <span
                        className="dashboard-list-status"
                        style={{ color: getStatusColor(s.status) }}
                      >
                        {getStatusLabel(s.status)}
                      </span>
                      <span className="dashboard-list-date">
                        {formatDate(s.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showConcessionariaModal && (
        <div
          className="dashboard-modal-overlay"
          onClick={closeConcessionariaModal}
          role="presentation"
        >
          <div
            className="dashboard-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-modal-concessionaria-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dashboard-modal-header">
              <h2 id="dashboard-modal-concessionaria-title">Nova Concessionária</h2>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={closeConcessionariaModal}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <p className="dashboard-modal-desc">
              A concessionária fica salva neste navegador e aparece ao criar uma nova solicitação.
            </p>
            <div className="dashboard-modal-form">
              <label htmlFor="dashboard-nova-concessionaria">Nome da concessionária</label>
              <div className="dashboard-modal-input-row">
                <input
                  id="dashboard-nova-concessionaria"
                  type="text"
                  value={novaConcessionaria}
                  onChange={(e) => setNovaConcessionaria(e.target.value)}
                  onKeyDown={handleNovaConcessionariaKeyDown}
                  placeholder="Ex: Arteris Litoral Sul"
                  autoFocus
                />
                <button
                  type="button"
                  className="dashboard-modal-submit"
                  onClick={handleAddConcessionaria}
                >
                  Cadastrar
                </button>
              </div>
            </div>
            {concessionariaFeedback && (
              <p className="dashboard-modal-feedback" role="status">
                {concessionariaFeedback}
              </p>
            )}
            {concessionarias.length > 0 && (
              <div className="dashboard-modal-list">
                <span className="dashboard-modal-list-title">
                  Concessionárias cadastradas ({concessionarias.length})
                </span>
                <ul>
                  {concessionarias.map((concessionaria) => (
                    <li key={concessionaria}>{concessionaria}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
