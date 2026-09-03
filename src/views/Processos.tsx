import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, FolderKanban, Plus, Search } from 'lucide-react'
import type { Cliente } from '../models/Cliente'
import { getClienteDisplayName } from '../models/Cliente'
import type { Processo } from '../models/Processo'
import { listClientes } from '../services/cliente/clienteService'
import { createProcesso, isProcessosMockMode, listProcessos } from '../services/processo/processoService'
import { Button, Input, Typography } from '../components/ui'
import './Processos.css'

export default function Processos() {
  const navigate = useNavigate()
  const [processos, setProcessos] = useState<Processo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [rodovia, setRodovia] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [proc, cli] = await Promise.all([listProcessos(), listClientes()])
      setProcessos(proc)
      setClientes(cli)
      setUsingMock(isProcessosMockMode())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar processos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return processos
    return processos.filter((item) =>
      [item.titulo, item.codigo, item.clienteNome, item.nomeConcessionaria, item.rodovia, item.revisaoAtual]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo),
    )
  }, [busca, processos])

  const handleCreate = async () => {
    if (!titulo.trim()) {
      setFormError('Informe o título do processo / projeto.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const cliente = clientes.find((item) => item.id === clienteId)
      const processo = await createProcesso({
        titulo: titulo.trim(),
        clienteId: cliente?.id ?? null,
        clienteNome: cliente ? getClienteDisplayName(cliente) : null,
        rodovia: rodovia.trim() || null,
      })
      setShowForm(false)
      setTitulo('')
      setClienteId('')
      setRodovia('')
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
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar processo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="processos-page">
      <div className="processos-header">
        <div>
          <Typography variant="h1">Processos</Typography>
          <Typography variant="muted">
            Agrupe R00, R01, R02… no mesmo atendimento, com histórico preservado.
            {usingMock
              ? ' Exibindo dados de demonstração até o Firestore de processos ser publicado.'
              : ''}
          </Typography>
        </div>
        <Button variant="primary" leftIcon={<Plus size={18} />} onClick={() => setShowForm(true)}>
          Novo processo (R00)
        </Button>
      </div>

      <div className="processos-toolbar">
        <div className="processos-search">
          <Search size={18} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar processo, cliente, rodovia..."
          />
        </div>
      </div>

      {error && !usingMock && (
        <div className="processos-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="processos-empty">Carregando processos...</div>
      ) : filtrados.length === 0 ? (
        <div className="processos-empty">
          <FolderKanban size={40} />
          <Typography variant="h3">Nenhum processo cadastrado</Typography>
          <Typography variant="muted">
            Crie um processo para a primeira análise (R00) e depois abra revisões vinculadas.
          </Typography>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Criar primeiro processo
          </Button>
        </div>
      ) : (
        <div className="processos-grid">
          {filtrados.map((processo) => (
            <Link key={processo.id} to={`/processos/${processo.id}`} className="processos-card">
              <div className="processos-card-top">
                <span className="processos-code">{processo.codigo || 'PROC'}</span>
                <span className="processos-rev">{processo.revisaoAtual}</span>
              </div>
              <strong>{processo.titulo}</strong>
              <span className="processos-meta">
                {[processo.clienteNome, processo.rodovia, processo.nomeConcessionaria]
                  .filter(Boolean)
                  .join(' · ') || 'Sem metadados'}
              </span>
              <span className={`processos-status status-${processo.status}`}>{processo.status}</span>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <div className="processos-modal-overlay" onClick={() => setShowForm(false)} role="presentation">
          <div className="processos-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <Typography variant="h3">Novo processo</Typography>
            <Typography variant="muted">
              Em seguida você será direcionado para registrar a solicitação R00.
            </Typography>
            <div className="processos-modal-form">
              <Input
                label="Título do projeto / processo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Ocupação FXD — BR-116 km 120"
              />
              <label className="processos-select-label">
                Cliente (opcional)
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Sem cliente vinculado</option>
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getClienteDisplayName(item)}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Rodovia (opcional)"
                value={rodovia}
                onChange={(e) => setRodovia(e.target.value)}
                placeholder="Ex: BR-116"
              />
              {formError && <p className="processos-form-error">{formError}</p>}
            </div>
            <div className="processos-modal-actions">
              <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="primary" loading={saving} onClick={() => void handleCreate()}>
                Criar e abrir R00
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
