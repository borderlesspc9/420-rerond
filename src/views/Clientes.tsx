import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Pencil, Plus, Search, Users } from 'lucide-react'
import type { Cliente, ClienteDraft } from '../models/Cliente'
import { getClienteDisplayName } from '../models/Cliente'
import {
  createCliente,
  isClientesMockMode,
  listClientes,
  updateCliente,
} from '../services/cliente/clienteService'
import { Button, Input, Typography } from '../components/ui'
import './Clientes.css'

const EMPTY_DRAFT: ClienteDraft = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  email: '',
  telefone: '',
  contatoNome: '',
  observacoes: '',
  ativo: true,
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ClienteDraft>({ ...EMPTY_DRAFT })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listClientes({ includeInactive: true })
      setClientes(data)
      setUsingMock(isClientesMockMode())
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar clientes.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return clientes
    return clientes.filter((item) => {
      const blob = [
        item.razaoSocial,
        item.nomeFantasia,
        item.cnpj,
        item.email,
        item.contatoNome,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(termo)
    })
  }, [busca, clientes])

  const openCreate = () => {
    setEditingId(null)
    setDraft({ ...EMPTY_DRAFT })
    setFormError(null)
    setShowForm(true)
  }

  const openEdit = (cliente: Cliente) => {
    setEditingId(cliente.id)
    setDraft({
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia ?? '',
      cnpj: cliente.cnpj ?? '',
      email: cliente.email ?? '',
      telefone: cliente.telefone ?? '',
      contatoNome: cliente.contatoNome ?? '',
      observacoes: cliente.observacoes ?? '',
      ativo: cliente.ativo,
    })
    setFormError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setDraft({ ...EMPTY_DRAFT })
    setFormError(null)
  }

  const handleSave = async () => {
    if (!draft.razaoSocial.trim()) {
      setFormError('Informe a razão social.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        await updateCliente(editingId, draft)
      } else {
        await createCliente(draft)
      }
      closeForm()
      await load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="clientes-page">
      <div className="clientes-header">
        <div>
          <Typography variant="h1">Clientes</Typography>
          <Typography variant="muted">
            Cadastro persistente para reutilizar dados em novas solicitações e revisões.
            {usingMock
              ? ' Exibindo dados de demonstração até o Firestore de clientes ser publicado.'
              : ''}
          </Typography>
        </div>
        <Button variant="primary" leftIcon={<Plus size={18} />} onClick={openCreate}>
          Novo cliente
        </Button>
      </div>

      <div className="clientes-toolbar">
        <div className="clientes-search">
          <Search size={18} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ, contato..."
          />
        </div>
        <Link to="/nova-solicitacao" className="clientes-link">
          Ir para nova solicitação
        </Link>
      </div>

      {error && !usingMock && (
        <div className="clientes-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="clientes-loading">Carregando clientes...</div>
      ) : filtrados.length === 0 ? (
        <div className="clientes-empty">
          <Users size={40} />
          <Typography variant="h3">Nenhum cliente encontrado</Typography>
          <Typography variant="muted">
            Cadastre o cliente uma vez e reutilize nas próximas solicitações.
          </Typography>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreate}>
            Cadastrar primeiro cliente
          </Button>
        </div>
      ) : (
        <div className="clientes-table-wrap">
          <table className="clientes-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CNPJ</th>
                <th>Contato</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{getClienteDisplayName(cliente)}</strong>
                    {cliente.nomeFantasia && (
                      <span className="clientes-sub">{cliente.razaoSocial}</span>
                    )}
                  </td>
                  <td>{cliente.cnpj || '—'}</td>
                  <td>
                    {cliente.contatoNome || cliente.email || cliente.telefone || '—'}
                    {(cliente.email || cliente.telefone) && cliente.contatoNome && (
                      <span className="clientes-sub">
                        {[cliente.email, cliente.telefone].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`clientes-badge ${cliente.ativo ? 'is-active' : 'is-inactive'}`}>
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Pencil size={14} />}
                      onClick={() => openEdit(cliente)}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="clientes-modal-overlay" onClick={closeForm} role="presentation">
          <div
            className="clientes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clientes-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clientes-modal-header">
              <Typography variant="h3" as="h2" id="clientes-modal-title">
                {editingId ? 'Editar cliente' : 'Novo cliente'}
              </Typography>
              <button type="button" className="clientes-modal-close" onClick={closeForm}>
                ×
              </button>
            </div>

            <div className="clientes-modal-form">
              <Input
                label="Razão social"
                value={draft.razaoSocial}
                onChange={(e) => setDraft((prev) => ({ ...prev, razaoSocial: e.target.value }))}
                placeholder="Ex: OHR TELECOM EIRELI"
              />
              <Input
                label="Nome fantasia"
                value={draft.nomeFantasia}
                onChange={(e) => setDraft((prev) => ({ ...prev, nomeFantasia: e.target.value }))}
                placeholder="Opcional"
              />
              <Input
                label="CNPJ"
                value={draft.cnpj}
                onChange={(e) => setDraft((prev) => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
              <Input
                label="Contato"
                value={draft.contatoNome}
                onChange={(e) => setDraft((prev) => ({ ...prev, contatoNome: e.target.value }))}
                placeholder="Nome do responsável"
              />
              <Input
                label="E-mail"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
              <Input
                label="Telefone"
                value={draft.telefone}
                onChange={(e) => setDraft((prev) => ({ ...prev, telefone: e.target.value }))}
              />
              <label className="clientes-textarea-label">
                Observações
                <textarea
                  value={draft.observacoes}
                  onChange={(e) => setDraft((prev) => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                />
              </label>
              <label className="clientes-check">
                <input
                  type="checkbox"
                  checked={draft.ativo !== false}
                  onChange={(e) => setDraft((prev) => ({ ...prev, ativo: e.target.checked }))}
                />
                Cliente ativo
              </label>
              {formError && <p className="clientes-form-error">{formError}</p>}
            </div>

            <div className="clientes-modal-actions">
              <Button variant="secondary" onClick={closeForm} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
                {editingId ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
