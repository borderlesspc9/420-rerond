import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Layers3 } from 'lucide-react'
import type { TipoAnalise, TipoAnaliseCategoria } from '../models/TipoAnalise'
import {
  isTiposAnaliseMockMode,
  listTiposAnalise,
  saveTipoAnalise,
} from '../services/tipoAnalise/tipoAnaliseService'
import './ConfiguracoesModulares.css'

const CATEGORIA_OPTIONS: Array<{ value: TipoAnaliseCategoria; label: string }> = [
  { value: 'ocupacao_faixa', label: 'Ocupação em faixa' },
  { value: 'poc', label: 'POC' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'pac', label: 'PAC' },
  { value: 'ppu', label: 'PPU / Publicidade' },
  { value: 'rede_eletrica', label: 'Rede elétrica' },
  { value: 'esgoto', label: 'Esgoto / saneamento' },
  { value: 'publicidade', label: 'Publicidade' },
  { value: 'sinalizacao', label: 'Sinalização' },
  { value: 'outro', label: 'Outro' },
]

export default function ConfiguracoesModulares() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tipos, setTipos] = useState<TipoAnalise[]>([])
  const [tipoNome, setTipoNome] = useState('')
  const [tipoCategoria, setTipoCategoria] = useState<TipoAnaliseCategoria>('outro')
  const [tipoDescricao, setTipoDescricao] = useState('')
  const [tipoPrompt, setTipoPrompt] = useState('')

  const reload = async () => {
    setTipos(await listTiposAnalise())
  }

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações.'),
    )
  }, [])

  return (
    <div className="config-modular">
      <header className="config-modular-header">
        <h1>
          <Layers3 size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Configurações modulares
        </h1>
        <p>
          Cadastro de tipos de análise. Para ensinar a IA (casos modelo e correções), use{' '}
          <Link to="/ensinar-ia">Ensinar a IA</Link>.
        </p>
        {isTiposAnaliseMockMode() && (
          <p className="config-modular-mock">
            Modo local ativo (Firestore sem permissão ainda). Os dados ficam no navegador até o
            deploy.
          </p>
        )}
      </header>

      {error && <div className="config-modular-error">{error}</div>}
      {success && <div className="config-modular-success">{success}</div>}

      <section className="config-modular-card">
        <h2>
          <Brain size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Cadastrar tipo
        </h2>
        <p className="config-modular-hint">
          Isola checklist/normas por domínio (ocupação ≠ acesso ≠ PAC). Use Outro para casos novos.
        </p>
        <div className="config-modular-grid">
          <label>
            Nome *
            <input value={tipoNome} onChange={(e) => setTipoNome(e.target.value)} />
          </label>
          <label>
            Categoria
            <select
              value={tipoCategoria}
              onChange={(e) => setTipoCategoria(e.target.value as TipoAnaliseCategoria)}
            >
              {CATEGORIA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Descrição *
          <textarea
            value={tipoDescricao}
            onChange={(e) => setTipoDescricao(e.target.value)}
            rows={2}
          />
        </label>
        <label>
          Orientação de prompt (opcional)
          <textarea value={tipoPrompt} onChange={(e) => setTipoPrompt(e.target.value)} rows={2} />
        </label>
        <button
          type="button"
          className="config-modular-btn"
          onClick={() => {
            void (async () => {
              setError(null)
              try {
                if (!tipoNome.trim() || !tipoDescricao.trim()) {
                  setError('Nome e descrição são obrigatórios.')
                  return
                }
                await saveTipoAnalise({
                  nome: tipoNome,
                  slug: '',
                  categoria: tipoCategoria,
                  descricao: tipoDescricao,
                  normasFontes: [],
                  documentosSugeridos: [],
                  requisitos: [],
                  promptOrientacao: tipoPrompt || undefined,
                })
                setTipoNome('')
                setTipoDescricao('')
                setTipoPrompt('')
                setSuccess('Tipo de análise salvo.')
                await reload()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao salvar tipo.')
              }
            })()
          }}
        >
          Salvar tipo
        </button>

        <h3 style={{ marginTop: 24 }}>Tipos ativos</h3>
        <ul className="config-modular-list">
          {tipos.map((tipo) => (
            <li key={tipo.id}>
              <strong>{tipo.nome}</strong>
              <span>
                {tipo.categoria} · {tipo.descricao}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
