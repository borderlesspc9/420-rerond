import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookMarked,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquareWarning,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import type { TipoAnalise } from '../models/TipoAnalise'
import type {
  GoldenCase,
  GoldenCaseDocumentoRef,
  GoldenCasePar,
  GoldenCaseValidacaoStatus,
} from '../models/GoldenCase'
import type { FeedbackAprendizado } from '../models/FeedbackAprendizado'
import { listTiposAnalise } from '../services/tipoAnalise/tipoAnaliseService'
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
  setGoldenCaseAtivo,
  setGoldenCaseStatus,
  suggestGoldenCodigo,
  updateGoldenCase,
} from '../services/goldenCase/goldenCaseService'
import {
  buildGoldenCasesPromptBlockFromCases,
  filterGoldenCasesAprovadosParaPreview,
  newParId,
} from '../utils/goldenCasePrompt'
import './EnsinarIA.css'

type HubTab = 'casos' | 'novo' | 'feedback' | 'preview'
type WizardStep = 1 | 2 | 3 | 4

const STATUS_LABEL: Record<GoldenCaseValidacaoStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

const emptyPar = (): GoldenCasePar => ({
  id: newParId(),
  regraOuItem: '',
  original: '',
  correto: '',
  justificativa: '',
})

export default function EnsinarIA() {
  const [tab, setTab] = useState<HubTab>('casos')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tipos, setTipos] = useState<TipoAnalise[]>([])
  const [goldens, setGoldens] = useState<GoldenCase[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackAprendizado[]>([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<GoldenCaseValidacaoStatus | ''>('')
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<GoldenCase | null>(null)

  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [gcTipoId, setGcTipoId] = useState('')
  const [gcCodigo, setGcCodigo] = useState('')
  const [gcTitulo, setGcTitulo] = useState('')
  const [gcDescricao, setGcDescricao] = useState('')
  const [gcObservacoes, setGcObservacoes] = useState('')
  const [gcPares, setGcPares] = useState<GoldenCasePar[]>([emptyPar()])
  const [gcDocs, setGcDocs] = useState<GoldenCaseDocumentoRef[]>([])
  const [docNome, setDocNome] = useState('')
  const [docUrl, setDocUrl] = useState('')

  const [fbTipoId, setFbTipoId] = useState('')
  const [fbRegra, setFbRegra] = useState('')
  const [fbOriginal, setFbOriginal] = useState('')
  const [fbCorrecao, setFbCorrecao] = useState('')
  const [fbJustificativa, setFbJustificativa] = useState('')

  const [previewTipoId, setPreviewTipoId] = useState('')
  const prevWizardTipoRef = useRef('')

  const tipoNome = (id: string) => tipos.find((t) => t.id === id)?.nome || id

  const reload = async () => {
    const [t, g, f] = await Promise.all([
      listTiposAnalise(),
      listGoldenCases({ includeInactive: true }),
      listFeedbacks(),
    ])
    setTipos(t)
    setGoldens(g)
    setFeedbacks(f)
  }

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Erro ao carregar hub Ensinar a IA.'),
    )
  }, [])

  // Sugere código só quando o tipo do wizard muda (não a cada reload da lista).
  useEffect(() => {
    if (!gcTipoId) {
      prevWizardTipoRef.current = ''
      return
    }
    if (gcTipoId === prevWizardTipoRef.current) return
    prevWizardTipoRef.current = gcTipoId
    const tipo = tipos.find((t) => t.id === gcTipoId)
    const slug = tipo?.slug || tipo?.id || gcTipoId
    setGcCodigo(suggestGoldenCodigo(slug, goldens.filter((g) => g.tipoAnaliseId === gcTipoId)))
  }, [gcTipoId, tipos, goldens])

  const filtrados = useMemo(() => {
    return goldens.filter((item) => {
      if (filtroTipo && item.tipoAnaliseId !== filtroTipo) return false
      if (filtroStatus && item.status !== filtroStatus) return false
      if (busca.trim()) {
        const q = busca.trim().toLowerCase()
        const hay = `${item.codigo} ${item.titulo} ${item.descricao ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [goldens, filtroTipo, filtroStatus, busca])

  const preview = useMemo(() => {
    const tipo = previewTipoId || filtroTipo
    if (!tipo) return { block: '', ids: [] as string[], items: [] as GoldenCase[] }
    const items = filterGoldenCasesAprovadosParaPreview(goldens, tipo, 3)
    const built = buildGoldenCasesPromptBlockFromCases(items)
    return { ...built, items }
  }, [goldens, previewTipoId, filtroTipo])

  const resetWizard = () => {
    setWizardStep(1)
    setGcTipoId('')
    setGcCodigo('')
    setGcTitulo('')
    setGcDescricao('')
    setGcObservacoes('')
    setGcPares([emptyPar()])
    setGcDocs([])
    setDocNome('')
    setDocUrl('')
  }

  const validateWizardStep = (step: WizardStep): string | null => {
    if (step === 1) {
      if (!gcTipoId) return 'Selecione o tipo de análise.'
      if (!gcTitulo.trim()) return 'Informe o título.'
      if (!gcCodigo.trim()) return 'Informe o código.'
    }
    if (step === 2) {
      const ok = gcPares.some(
        (p) => p.original.trim() && p.correto.trim() && p.justificativa.trim(),
      )
      if (!ok) return 'Preencha ao menos um par completo (errado, certo e justificativa).'
    }
    return null
  }

  const handleSalvarCaso = async (status: GoldenCaseValidacaoStatus) => {
    setError(null)
    const err = validateWizardStep(1) || validateWizardStep(2)
    if (err) {
      setError(err)
      return
    }
    try {
      const pares = gcPares.filter(
        (p) => p.original.trim() && p.correto.trim() && p.justificativa.trim(),
      )
      await createGoldenCase({
        codigo: gcCodigo,
        titulo: gcTitulo,
        tipoAnaliseId: gcTipoId,
        descricao: gcDescricao || undefined,
        observacoes: gcObservacoes || undefined,
        pares,
        documentosRef: gcDocs,
        analiseCorreta: pares.map((p) => p.correto).join('\n\n'),
        erroIa: pares[0]?.original,
        status,
      })
      setSuccess(
        status === 'pendente'
          ? 'Caso enviado para validação. Após aprovação, entra no acervo de ensino do tipo.'
          : 'Caso salvo.',
      )
      resetWizard()
      setTab('casos')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar caso.')
    }
  }

  const mockBanner = isGoldenCasesMockMode() || isFeedbacksMockMode()

  return (
    <div className="ensinar-ia">
      <header className="ensinar-ia-header">
        <div>
          <p className="ensinar-ia-eyebrow">
            <Sparkles size={14} /> Ensino controlado
          </p>
          <h1>
            <Brain size={26} /> Ensinar a IA
          </h1>
          <p>
            Registre o que está <strong>errado</strong> e o que é <strong>certo</strong> por tipo de
            análise. Isto <strong>não</strong> é edição de parecer. Só itens{' '}
            <strong>aprovados</strong> entram em análises futuras do mesmo tipo — quando a chave
            OpenAI e o deploy estiverem ativos. Até lá, o acervo e o preview ficam prontos.
          </p>
        </div>
        {mockBanner && (
          <p className="ensinar-ia-mock">
            Modo local (Firestore sem permissão). Dados no navegador + seeds de demonstração.
          </p>
        )}
      </header>

      <div className="ensinar-ia-tabs">
        <button type="button" className={tab === 'casos' ? 'active' : ''} onClick={() => setTab('casos')}>
          <BookMarked size={16} /> Casos modelo
        </button>
        <button
          type="button"
          className={tab === 'novo' ? 'active' : ''}
          onClick={() => {
            resetWizard()
            setTab('novo')
          }}
        >
          <Plus size={16} /> Novo caso
        </button>
        <button
          type="button"
          className={tab === 'feedback' ? 'active' : ''}
          onClick={() => setTab('feedback')}
        >
          <MessageSquareWarning size={16} /> Correção pontual
        </button>
        <button
          type="button"
          className={tab === 'preview' ? 'active' : ''}
          onClick={() => setTab('preview')}
        >
          <Eye size={16} /> O que a IA receberia
        </button>
      </div>

      {error && <div className="ensinar-ia-error">{error}</div>}
      {success && <div className="ensinar-ia-success">{success}</div>}

      {tab === 'casos' && (
        <section className="ensinar-ia-card">
          <div className="ensinar-ia-filters">
            <label>
              Tipo
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as GoldenCaseValidacaoStatus | '')}
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Busca
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código ou título…"
              />
            </label>
          </div>

          {filtrados.length === 0 ? (
            <div className="ensinar-ia-empty">
              <h3>Nenhum caso modelo ainda</h3>
              <p>
                Comece por um caso completo: tipo + pares errado×certo. Em poucos minutos o acervo
                fica pronto para ensinar a IA do mesmo domínio.
              </p>
              <button type="button" className="ensinar-ia-btn" onClick={() => setTab('novo')}>
                Cadastrar primeiro caso
              </button>
            </div>
          ) : (
            <div className="ensinar-ia-grid-cards">
              {filtrados.map((item) => {
                const par0 = item.pares[0]
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="ensinar-ia-case-card"
                    onClick={() => setSelecionado(item)}
                  >
                    <div className="ensinar-ia-case-card-top">
                      <span className={`ensinar-ia-badge status-${item.status}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                      {!item.ativo && <span className="ensinar-ia-badge inactive">Inativo</span>}
                    </div>
                    <strong>
                      {item.codigo} — {item.titulo}
                    </strong>
                    <span className="ensinar-ia-muted">{tipoNome(item.tipoAnaliseId)}</span>
                    {par0 && (
                      <p className="ensinar-ia-pair-preview">
                        <span className="wrong">Errado:</span> {par0.original.slice(0, 100)}
                        {par0.original.length > 100 ? '…' : ''}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'novo' && (
        <section className="ensinar-ia-card">
          <div className="ensinar-ia-steps">
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className={wizardStep === s ? 'active' : wizardStep > s ? 'done' : ''}>
                {s}.{' '}
                {s === 1 ? 'Tipo' : s === 2 ? 'Errado × certo' : s === 3 ? 'Documentos' : 'Revisão'}
              </span>
            ))}
          </div>

          {wizardStep === 1 && (
            <>
              <h2>1. Tipo e metadados</h2>
              <p className="ensinar-ia-hint">
                O caso só ensina análises do <strong>mesmo tipo</strong>. Código sugerido
                automaticamente.
              </p>
              <label>
                Tipo de análise *
                <select value={gcTipoId} onChange={(e) => setGcTipoId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ensinar-ia-grid">
                <label>
                  Código *
                  <input value={gcCodigo} onChange={(e) => setGcCodigo(e.target.value)} />
                </label>
                <label>
                  Título *
                  <input value={gcTitulo} onChange={(e) => setGcTitulo(e.target.value)} />
                </label>
              </div>
              <label>
                Descrição (opcional)
                <textarea value={gcDescricao} onChange={(e) => setGcDescricao(e.target.value)} rows={2} />
              </label>
            </>
          )}

          {wizardStep === 2 && (
            <>
              <h2>2. Pares errado × certo</h2>
              <p className="ensinar-ia-hint">
                Cada par ensina um erro típico da IA e a correção esperada, com justificativa.
              </p>
              {gcPares.map((par, index) => (
                <div key={par.id} className="ensinar-ia-par">
                  <div className="ensinar-ia-par-head">
                    <strong>Par {index + 1}</strong>
                    {gcPares.length > 1 && (
                      <button
                        type="button"
                        className="ensinar-ia-linkish"
                        onClick={() => setGcPares((prev) => prev.filter((p) => p.id !== par.id))}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <label>
                    Item / regra (opcional)
                    <input
                      value={par.regraOuItem ?? ''}
                      onChange={(e) =>
                        setGcPares((prev) =>
                          prev.map((p) =>
                            p.id === par.id ? { ...p, regraOuItem: e.target.value } : p,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Errado (o que a IA fez/disse) *
                    <textarea
                      value={par.original}
                      onChange={(e) =>
                        setGcPares((prev) =>
                          prev.map((p) =>
                            p.id === par.id ? { ...p, original: e.target.value } : p,
                          ),
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <label>
                    Correto *
                    <textarea
                      value={par.correto}
                      onChange={(e) =>
                        setGcPares((prev) =>
                          prev.map((p) =>
                            p.id === par.id ? { ...p, correto: e.target.value } : p,
                          ),
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <label>
                    Justificativa *
                    <textarea
                      value={par.justificativa}
                      onChange={(e) =>
                        setGcPares((prev) =>
                          prev.map((p) =>
                            p.id === par.id ? { ...p, justificativa: e.target.value } : p,
                          ),
                        )
                      }
                      rows={2}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="ensinar-ia-btn secondary"
                onClick={() => setGcPares((prev) => [...prev, emptyPar()])}
              >
                + Adicionar par
              </button>
            </>
          )}

          {wizardStep === 3 && (
            <>
              <h2>3. Documentos de referência</h2>
              <p className="ensinar-ia-hint">
                Metadados / URL (upload nativo de Storage pode vir depois). Opcional.
              </p>
              <div className="ensinar-ia-grid">
                <label>
                  Nome do arquivo
                  <input value={docNome} onChange={(e) => setDocNome(e.target.value)} />
                </label>
                <label>
                  URL (opcional)
                  <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} />
                </label>
              </div>
              <button
                type="button"
                className="ensinar-ia-btn secondary"
                onClick={() => {
                  if (!docNome.trim()) return
                  setGcDocs((prev) => [
                    ...prev,
                    { nome: docNome.trim(), url: docUrl.trim() || null, storagePath: null },
                  ])
                  setDocNome('')
                  setDocUrl('')
                }}
              >
                Adicionar documento
              </button>
              <ul className="ensinar-ia-doc-list">
                {gcDocs.map((d, i) => (
                  <li key={`${d.nome}-${i}`}>
                    {d.nome}
                    {d.url ? ` — ${d.url}` : ''}
                    <button
                      type="button"
                      onClick={() => setGcDocs((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <label>
                Observações (opcional)
                <textarea
                  value={gcObservacoes}
                  onChange={(e) => setGcObservacoes(e.target.value)}
                  rows={2}
                />
              </label>
            </>
          )}

          {wizardStep === 4 && (
            <>
              <h2>4. Revisão</h2>
              <p className="ensinar-ia-hint">
                Ao enviar para validação, o caso fica <strong>pendente</strong> até aprovação.
              </p>
              <dl className="ensinar-ia-review">
                <div>
                  <dt>Tipo</dt>
                  <dd>{tipoNome(gcTipoId)}</dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>{gcCodigo}</dd>
                </div>
                <div>
                  <dt>Título</dt>
                  <dd>{gcTitulo}</dd>
                </div>
                <div>
                  <dt>Pares</dt>
                  <dd>{gcPares.filter((p) => p.original && p.correto && p.justificativa).length}</dd>
                </div>
                <div>
                  <dt>Documentos</dt>
                  <dd>{gcDocs.length}</dd>
                </div>
              </dl>
              <div className="ensinar-ia-actions">
                <button
                  type="button"
                  className="ensinar-ia-btn"
                  onClick={() => void handleSalvarCaso('pendente')}
                >
                  <CheckCircle2 size={16} /> Enviar para validação
                </button>
              </div>
            </>
          )}

          <div className="ensinar-ia-wizard-nav">
            <button
              type="button"
              className="ensinar-ia-btn secondary"
              disabled={wizardStep === 1}
              onClick={() => setWizardStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            {wizardStep < 4 && (
              <button
                type="button"
                className="ensinar-ia-btn"
                onClick={() => {
                  const err = validateWizardStep(wizardStep)
                  if (err) {
                    setError(err)
                    return
                  }
                  setError(null)
                  setWizardStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s))
                }}
              >
                Continuar <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      )}

      {tab === 'feedback' && (
        <section className="ensinar-ia-card">
          <h2>Correção pontual</h2>
          <p className="ensinar-ia-hint">
            Atalho para um único item (regra → errado → certo). Para ensinar um caso completo com
            vários pares, use{' '}
            <button type="button" className="ensinar-ia-linkish" onClick={() => setTab('novo')}>
              Novo caso modelo
            </button>
            .
          </p>
          <label>
            Tipo *
            <select value={fbTipoId} onChange={(e) => setFbTipoId(e.target.value)}>
              <option value="">Selecione…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
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
            className="ensinar-ia-btn"
            onClick={() => {
              void (async () => {
                setError(null)
                if (!fbTipoId.trim()) {
                  setError('Selecione o tipo.')
                  return
                }
                try {
                  await createFeedback({
                    tipoAnaliseId: fbTipoId,
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
                  setSuccess('Correção pontual enviada para validação.')
                  await reload()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erro ao registrar feedback.')
                }
              })()
            }}
          >
            Enviar para validação
          </button>

          <h3>Fila</h3>
          <ul className="ensinar-ia-list">
            {feedbacks.map((item) => (
              <li key={item.id}>
                <strong>
                  [{item.status}] {item.regraOuItem}
                </strong>
                <span>
                  {item.original.slice(0, 100)}
                  {item.original.length > 100 ? '…' : ''}
                </span>
                {(item.status === 'pendente' || item.status === 'rascunho') && (
                  <div className="ensinar-ia-row-actions">
                    <button type="button" onClick={() => void setFeedbackStatus(item.id, 'aprovado').then(reload)}>
                      Aprovar
                    </button>
                    <button type="button" onClick={() => void setFeedbackStatus(item.id, 'rejeitado').then(reload)}>
                      Rejeitar
                    </button>
                  </div>
                )}
                {item.status === 'aprovado' && (
                  <div className="ensinar-ia-row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        void setFeedbackStatus(item.id, 'rejeitado', 'Revogado').then(reload)
                      }
                    >
                      Revogar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {feedbacks.length === 0 && <li>Nenhuma correção pontual ainda.</li>}
          </ul>
        </section>
      )}

      {tab === 'preview' && (
        <section className="ensinar-ia-card">
          <h2>Pré-visualização do contexto de ensino</h2>
          <p className="ensinar-ia-hint">
            Mostra o bloco que a análise receberia para o tipo (casos <strong>aprovados</strong>,
            máx. 3). A análise real só roda com chave OpenAI + deploy das functions.
          </p>
          <label>
            Tipo para preview
            <select
              value={previewTipoId}
              onChange={(e) => setPreviewTipoId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          {preview.ids.length > 0 ? (
            <>
              <p className="ensinar-ia-muted">IDs: {preview.ids.join(', ')}</p>
              <pre className="ensinar-ia-preview-block">{preview.block}</pre>
            </>
          ) : (
            <p className="ensinar-ia-muted">
              Nenhum caso aprovado para este tipo. Aprove casos na lista para ver o bloco.
            </p>
          )}
        </section>
      )}

      <p className="ensinar-ia-footer-link">
        Tipos de análise e cadastros técnicos:{' '}
        <Link to="/configuracoes">Configurações</Link>
      </p>

      {selecionado && (
        <div className="ensinar-ia-drawer-overlay" onClick={() => setSelecionado(null)}>
          <aside className="ensinar-ia-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <h2>
                  {selecionado.codigo} — {selecionado.titulo}
                </h2>
                <p className="ensinar-ia-muted">
                  {tipoNome(selecionado.tipoAnaliseId)} · {STATUS_LABEL[selecionado.status]}
                  {!selecionado.ativo ? ' · inativo' : ''}
                </p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setSelecionado(null)}>
                <X size={20} />
              </button>
            </header>

            {selecionado.descricao && <p>{selecionado.descricao}</p>}

            <h3>Pares errado × certo</h3>
            {selecionado.pares.length === 0 && <p className="ensinar-ia-muted">Sem pares.</p>}
            {selecionado.pares.map((par, i) => (
              <div key={par.id} className="ensinar-ia-par-view">
                <strong>
                  Par {i + 1}
                  {par.regraOuItem ? ` — ${par.regraOuItem}` : ''}
                </strong>
                <p>
                  <span className="wrong">Errado:</span> {par.original}
                </p>
                <p>
                  <span className="right">Correto:</span> {par.correto}
                </p>
                <p>
                  <span className="why">Por quê:</span> {par.justificativa}
                </p>
              </div>
            ))}

            {selecionado.documentosRef.length > 0 && (
              <>
                <h3>Documentos</h3>
                <ul>
                  {selecionado.documentosRef.map((d, i) => (
                    <li key={`${d.nome}-${i}`}>
                      {d.nome}
                      {d.url ? (
                        <>
                          {' '}
                          —{' '}
                          <a href={d.url} target="_blank" rel="noreferrer">
                            link
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="ensinar-ia-row-actions">
              {(selecionado.status === 'pendente' || selecionado.status === 'rascunho') && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void setGoldenCaseStatus(selecionado.id, 'aprovado').then(async () => {
                        await reload()
                        setSelecionado(null)
                        setSuccess('Caso aprovado — entra no ensino do tipo.')
                      })
                    }
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void setGoldenCaseStatus(selecionado.id, 'rejeitado').then(async () => {
                        await reload()
                        setSelecionado(null)
                      })
                    }
                  >
                    Rejeitar
                  </button>
                </>
              )}
              {selecionado.status === 'aprovado' && (
                <button
                  type="button"
                  onClick={() =>
                    void setGoldenCaseStatus(
                      selecionado.id,
                      'rejeitado',
                      'Revogado — deixa de entrar nas análises',
                    ).then(async () => {
                      await reload()
                      setSelecionado(null)
                    })
                  }
                >
                  Revogar
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  void setGoldenCaseAtivo(selecionado.id, !selecionado.ativo).then(async () => {
                    await reload()
                    setSelecionado(null)
                  })
                }
              >
                {selecionado.ativo ? 'Desativar' : 'Reativar'}
              </button>
              {selecionado.status === 'rejeitado' && (
                <button
                  type="button"
                  onClick={() =>
                    void updateGoldenCase(selecionado.id, { status: 'pendente' }).then(async () => {
                      await reload()
                      setSelecionado(null)
                    })
                  }
                >
                  Reabrir como pendente
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
