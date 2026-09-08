import { useEffect, useState } from 'react'
import { BookMarked, Brain, Layers3, MessageSquareWarning } from 'lucide-react'
import type { TipoAnalise, TipoAnaliseCategoria } from '../models/TipoAnalise'
import type { FeedbackAprendizado } from '../models/FeedbackAprendizado'
import type { GoldenCase } from '../models/GoldenCase'
import {
  isTiposAnaliseMockMode,
  listTiposAnalise,
  saveTipoAnalise,
} from '../services/tipoAnalise/tipoAnaliseService'
import {
  createFeedback,
  isFeedbacksMockMode,
  listFeedbacks,
  setFeedbackStatus,
} from '../services/feedback/feedbackService'
import {
  createGoldenCase,
  isGoldenCasesMockMode,
  listGoldenCases,
} from '../services/goldenCase/goldenCaseService'
import './ConfiguracoesModulares.css'

type TabId = 'tipos' | 'feedbacks' | 'golden'

const CATEGORIA_OPTIONS: Array<{ value: TipoAnaliseCategoria; label: string }> = [
  { value: 'ocupacao_faixa', label: 'Ocupação em faixa' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'pac', label: 'PAC' },
  { value: 'rede_eletrica', label: 'Rede elétrica' },
  { value: 'esgoto', label: 'Esgoto / saneamento' },
  { value: 'publicidade', label: 'Publicidade' },
  { value: 'sinalizacao', label: 'Sinalização' },
  { value: 'outro', label: 'Outro' },
]

export default function ConfiguracoesModulares() {
  const [tab, setTab] = useState<TabId>('tipos')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [tipos, setTipos] = useState<TipoAnalise[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackAprendizado[]>([])
  const [goldens, setGoldens] = useState<GoldenCase[]>([])

  const [tipoNome, setTipoNome] = useState('')
  const [tipoCategoria, setTipoCategoria] = useState<TipoAnaliseCategoria>('outro')
  const [tipoDescricao, setTipoDescricao] = useState('')
  const [tipoPrompt, setTipoPrompt] = useState('')

  const [fbRegra, setFbRegra] = useState('')
  const [fbOriginal, setFbOriginal] = useState('')
  const [fbCorrecao, setFbCorrecao] = useState('')
  const [fbJustificativa, setFbJustificativa] = useState('')
  const [fbTipoId, setFbTipoId] = useState('')

  const [gcCodigo, setGcCodigo] = useState('')
  const [gcTitulo, setGcTitulo] = useState('')
  const [gcTipoId, setGcTipoId] = useState('')
  const [gcErro, setGcErro] = useState('')
  const [gcCorreta, setGcCorreta] = useState('')

  const reload = async () => {
    const [t, f, g] = await Promise.all([
      listTiposAnalise(),
      listFeedbacks(),
      listGoldenCases(),
    ])
    setTipos(t)
    setFeedbacks(f)
    setGoldens(g)
  }

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações.'),
    )
  }, [])

  const mockBanner =
    isTiposAnaliseMockMode() || isFeedbacksMockMode() || isGoldenCasesMockMode()

  return (
    <div className="config-modular">
      <header className="config-modular-header">
        <h1>
          <Layers3 size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Configurações modulares
        </h1>
        <p>
          Tipos de análise, feedback estruturado e golden cases — funcionam com mock local até o
          deploy das rules no Firebase do cliente.
        </p>
        {mockBanner && (
          <p className="config-modular-mock">
            Modo local ativo (Firestore sem permissão ainda). Os dados ficam no navegador até o
            deploy.
          </p>
        )}
      </header>

      <div className="config-modular-tabs">
        <button
          type="button"
          className={tab === 'tipos' ? 'active' : ''}
          onClick={() => setTab('tipos')}
        >
          <Brain size={16} /> Tipos de análise
        </button>
        <button
          type="button"
          className={tab === 'feedbacks' ? 'active' : ''}
          onClick={() => setTab('feedbacks')}
        >
          <MessageSquareWarning size={16} /> Feedback / aprendizado
        </button>
        <button
          type="button"
          className={tab === 'golden' ? 'active' : ''}
          onClick={() => setTab('golden')}
        >
          <BookMarked size={16} /> Golden cases
        </button>
      </div>

      {error && <div className="config-modular-error">{error}</div>}
      {success && <div className="config-modular-success">{success}</div>}

      {tab === 'tipos' && (
        <section className="config-modular-card">
          <h2>Cadastrar tipo</h2>
          <p className="config-modular-hint">
            Isola checklist/normas por domínio (ocupação ≠ acesso ≠ PAC). Use Outro para casos
            novos.
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
      )}

      {tab === 'feedbacks' && (
        <section className="config-modular-card">
          <h2>Registrar feedback estruturado</h2>
          <p className="config-modular-hint">
            Isto <strong>não</strong> é edição de parecer. Só feedback com status{" "}
            <strong>aprovado</strong> entra em análises futuras do <strong>mesmo tipo</strong>{" "}
            (máx. 8 por análise). Pendente/rejeitado/rascunho não influenciam. Em conflito com
            normas ou evidência documental, prevalecem as normas.
          </p>
          <label>
            Tipo de análise *
            <select value={fbTipoId} onChange={(e) => setFbTipoId(e.target.value)}>
              <option value="">Selecione...</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Item / regra *
            <input value={fbRegra} onChange={(e) => setFbRegra(e.target.value)} />
          </label>
          <label>
            Original (errado) *
            <textarea value={fbOriginal} onChange={(e) => setFbOriginal(e.target.value)} rows={2} />
          </label>
          <label>
            Correção (certo) *
            <textarea value={fbCorrecao} onChange={(e) => setFbCorrecao(e.target.value)} rows={2} />
          </label>
          <label>
            Justificativa *
            <textarea
              value={fbJustificativa}
              onChange={(e) => setFbJustificativa(e.target.value)}
              rows={2}
            />
          </label>
          <button
            type="button"
            className="config-modular-btn"
            onClick={() => {
              void (async () => {
                setError(null)
                if (!fbTipoId.trim()) {
                  setError('Selecione o tipo de análise. Feedback sem tipo não entra na IA.')
                  return
                }
                try {
                  await createFeedback({
                    tipoAnaliseId: fbTipoId || null,
                    regraOuItem: fbRegra,
                    original: fbOriginal,
                    correcao: fbCorrecao,
                    justificativa: fbJustificativa,
                    status: 'pendente',
                  })
                  setFbRegra('')
                  setFbOriginal('')
                  setFbCorrecao('')
                  setFbJustificativa('')
                  setSuccess('Feedback registrado como pendente de validação.')
                  await reload()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erro ao registrar feedback.')
                }
              })()
            }}
          >
            Enviar para validação
          </button>

          <h3 style={{ marginTop: 24 }}>Fila de validação</h3>
          <ul className="config-modular-list">
            {feedbacks.map((item) => (
              <li key={item.id}>
                <strong>
                  [{item.status}] {item.regraOuItem}
                </strong>
                <span>
                  Errado: {item.original.slice(0, 120)}
                  {item.original.length > 120 ? '…' : ''}
                </span>
                <span>
                  Correto: {item.correcao.slice(0, 120)}
                  {item.correcao.length > 120 ? '…' : ''}
                </span>
                {item.status === 'pendente' || item.status === 'rascunho' ? (
                  <div className="config-modular-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void setFeedbackStatus(item.id, 'aprovado').then(reload)
                      }}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void setFeedbackStatus(item.id, 'rejeitado').then(reload)
                      }}
                    >
                      Rejeitar
                    </button>
                  </div>
                ) : null}
                {item.status === 'aprovado' ? (
                  <div className="config-modular-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void setFeedbackStatus(
                          item.id,
                          'rejeitado',
                          'Revogado — deixa de entrar nas próximas análises',
                        ).then(reload)
                      }}
                    >
                      Revogar (parar de usar na IA)
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
            {feedbacks.length === 0 && <li>Nenhum feedback ainda.</li>}
          </ul>
        </section>
      )}

      {tab === 'golden' && (
        <section className="config-modular-card">
          <h2>Cadastrar golden case</h2>
          <p className="config-modular-hint">
            Caso modelo por tipo (docs + erro da IA + análise correta). Recuperação na análise
            entra quando a API de IA estiver disponível.
          </p>
          <div className="config-modular-grid">
            <label>
              Código * (ex.: ocupacao/caso-001)
              <input value={gcCodigo} onChange={(e) => setGcCodigo(e.target.value)} />
            </label>
            <label>
              Tipo de análise *
              <select value={gcTipoId} onChange={(e) => setGcTipoId(e.target.value)}>
                <option value="">Selecione...</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Título *
            <input value={gcTitulo} onChange={(e) => setGcTitulo(e.target.value)} />
          </label>
          <label>
            Erro da IA (opcional)
            <textarea value={gcErro} onChange={(e) => setGcErro(e.target.value)} rows={2} />
          </label>
          <label>
            Análise correta *
            <textarea value={gcCorreta} onChange={(e) => setGcCorreta(e.target.value)} rows={4} />
          </label>
          <button
            type="button"
            className="config-modular-btn"
            onClick={() => {
              void (async () => {
                setError(null)
                try {
                  await createGoldenCase({
                    codigo: gcCodigo,
                    titulo: gcTitulo,
                    tipoAnaliseId: gcTipoId,
                    erroIa: gcErro || undefined,
                    analiseCorreta: gcCorreta,
                  })
                  setGcCodigo('')
                  setGcTitulo('')
                  setGcErro('')
                  setGcCorreta('')
                  setSuccess('Golden case cadastrado.')
                  await reload()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erro ao salvar golden case.')
                }
              })()
            }}
          >
            Salvar caso modelo
          </button>

          <h3 style={{ marginTop: 24 }}>Casos cadastrados</h3>
          <ul className="config-modular-list">
            {goldens.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.codigo} — {item.titulo}
                </strong>
                <span>Tipo: {item.tipoAnaliseId}</span>
              </li>
            ))}
            {goldens.length === 0 && <li>Nenhum caso modelo ainda.</li>}
          </ul>
        </section>
      )}
    </div>
  )
}
