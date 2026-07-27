import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  History,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react'
import type { ChecklistItem, ConferenciaInput, DadosExtraidosAnalise, TipoRelatorio } from '../models/Solicitacao'
import type {
  RelatorioConformidadePayload,
  RelatorioMetadadosEditaveis,
  RelatorioPdfHistoricoItem,
} from '../models/RelatorioConformidade'
import {
  CONFIDENCIALIDADE_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  aplicarMetadadosAoPayload,
  formatDateTimeBr,
  formatPercent,
  montarRelatorioConformidade,
} from '../utils/relatorioConformidade'
import { BASEINFRA_THEME, getLogoConcessionariaPath } from '../config/baseinfraTheme'
import { getLogoConcessionariaCadastrada, addConcessionaria, loadConcessionarias } from '../utils/concessionariasStorage'
import { auth } from '../lib/firebase'
import {
  baixarRelatorioPdf,
  gerarRelatorioPdf,
  listarRelatoriosPdf,
  uploadLogoConcessionaria,
} from '../services/relatorio/relatorioConformidadeService'
import './RelatorioConformidadeView.css'

export interface RelatorioConformidadeViewProps {
  solicitacaoId: string
  titulo: string
  checklistItems: ChecklistItem[]
  checklistConformidadeRaw?: string
  parecerTecnico?: string
  relatorioIA?: string
  tipoRelatorio?: TipoRelatorio
  concessionariaId?: string | null
  nomeConcessionaria?: string | null
  nroProcessoErp?: string | null
  rodovia?: string | null
  kilometragem?: string | null
  localizacao?: string
  descricao?: string
  tipoObra?: string
  responsavelTecnico?: string | null
  analistaResponsavel?: string | null
  cliente?: string | null
  analisadoEm?: Date | string | null
  dadosExtraidos?: DadosExtraidosAnalise | null
  conferenciaInputs?: ConferenciaInput[]
}

type ViewMode = 'preview' | 'edit'

export default function RelatorioConformidadeView(props: RelatorioConformidadeViewProps) {
  const user = auth.currentUser

  const payloadBase = useMemo(
    () =>
      montarRelatorioConformidade({
        solicitacaoId: props.solicitacaoId,
        titulo: props.titulo,
        tipoObra: props.tipoObra,
        localizacao: props.localizacao,
        descricao: props.descricao,
        nomeConcessionaria: props.nomeConcessionaria,
        nroProcessoErp: props.nroProcessoErp,
        rodovia: props.rodovia,
        kilometragem: props.kilometragem,
        responsavelTecnico: props.responsavelTecnico,
        analistaResponsavel: props.analistaResponsavel,
        cliente: props.cliente,
        analisadoEm: props.analisadoEm,
        tipoRelatorio: props.tipoRelatorio,
        concessionariaId: props.concessionariaId,
        checklistItems: props.checklistItems,
        parecerTecnico: props.parecerTecnico,
        relatorioIA: props.relatorioIA,
        checklistConformidadeRaw: props.checklistConformidadeRaw,
        dadosExtraidos: props.dadosExtraidos,
        conferenciaInputs: props.conferenciaInputs,
        usuarioAtual: user
          ? { uid: user.uid, displayName: user.displayName, email: user.email }
          : null,
      }),
    [props, user],
  )

  const [metadados, setMetadados] = useState<RelatorioMetadadosEditaveis>(payloadBase.metadados)
  const [mode, setMode] = useState<ViewMode>('preview')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [ultimoGerado, setUltimoGerado] = useState<{
    reportId: string
    fileName: string
    downloadUrl: string
    versao: number
  } | null>(null)
  const [historico, setHistorico] = useState<RelatorioPdfHistoricoItem[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const gerandoLock = useRef(false)

  const payload: RelatorioConformidadePayload = useMemo(
    () => aplicarMetadadosAoPayload(payloadBase, metadados),
    [payloadBase, metadados],
  )

  const carregarHistorico = useCallback(async () => {
    const items = await listarRelatoriosPdf(props.solicitacaoId)
    setHistorico(items)
  }, [props.solicitacaoId])

  useEffect(() => {
    setMetadados(payloadBase.metadados)
  }, [payloadBase.metadados])

  // Carrega logo da concessionária (public/ ou cadastro local) quando aplicável
  useEffect(() => {
    const nome = metadados.nomeConcessionaria || props.nomeConcessionaria
    const id = props.concessionariaId
    if (metadados.logoConcessionariaDataUrl || metadados.logoConcessionariaUrl) return

    const cadastrada = getLogoConcessionariaCadastrada(nome)
    if (cadastrada?.dataUrl || cadastrada?.url) {
      setMetadados((prev) => ({
        ...prev,
        logoConcessionariaUrl: cadastrada.url || null,
        logoConcessionariaDataUrl: cadastrada.dataUrl || null,
      }))
      return
    }

    const logoPath = getLogoConcessionariaPath(nome, id)
    if (!logoPath) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(logoPath)
        if (!res.ok) return
        const blob = await res.blob()
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error(`Falha ao ler logo ${logoPath}`))
          reader.readAsDataURL(blob)
        })
        if (!cancelled) {
          setMetadados((prev) => ({
            ...prev,
            logoConcessionariaUrl: logoPath,
            logoConcessionariaDataUrl: dataUrl,
          }))
        }
      } catch {
        // mantém placeholder
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    metadados.logoConcessionariaDataUrl,
    metadados.logoConcessionariaUrl,
    metadados.nomeConcessionaria,
    props.nomeConcessionaria,
    props.concessionariaId,
  ])

  useEffect(() => {
    void carregarHistorico()
  }, [carregarHistorico])

  const statusClass = `rc-status rc-status-${payload.statusGeral}`

  const handleGerar = async () => {
    if (gerandoLock.current) return
    gerandoLock.current = true
    setGerando(true)
    setErro(null)
    setSucesso(null)
    try {
      const result = await gerarRelatorioPdf(props.solicitacaoId, payload, { forceNew: true })
      setUltimoGerado({
        reportId: result.reportId,
        fileName: result.fileName,
        downloadUrl: result.downloadUrl,
        versao: result.versao,
      })
      setSucesso(
        `PDF gerado (v${result.versao}): Relatório de Análise Técnica com identidade BaseInfra.`,
      )
      await carregarHistorico()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o relatório PDF.'
      setErro(message)
    } finally {
      setGerando(false)
      gerandoLock.current = false
    }
  }

  const handleBaixar = async (reportId?: string, fileName?: string) => {
    const id = reportId || ultimoGerado?.reportId
    if (!id) {
      setErro('Gere o PDF antes de baixar.')
      return
    }
    setErro(null)
    try {
      await baixarRelatorioPdf(
        props.solicitacaoId,
        id,
        fileName || ultimoGerado?.fileName,
      )
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Falha ao baixar o PDF.')
    }
  }

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadingLogo(true)
    setErro(null)
    try {
      const result = await uploadLogoConcessionaria(file, metadados.nomeConcessionaria)
      setMetadados((prev) => ({
        ...prev,
        logoConcessionariaUrl: result.url || prev.logoConcessionariaUrl,
        logoConcessionariaDataUrl: result.dataUrl,
      }))
      if (metadados.nomeConcessionaria?.trim()) {
        addConcessionaria(loadConcessionarias(), metadados.nomeConcessionaria, {
          dataUrl: result.dataUrl,
          url: result.url || null,
        })
      }
      setSucesso('Logotipo da concessionária atualizado.')
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Falha no upload do logotipo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const updateField = <K extends keyof RelatorioMetadadosEditaveis>(
    key: K,
    value: RelatorioMetadadosEditaveis[K],
  ) => {
    setMetadados((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="rc-view">
      <header className="rc-header">
        <div className="rc-brand">
          <img
            src={BASEINFRA_THEME.logoPath}
            alt={`Logotipo ${BASEINFRA_THEME.brandName}`}
            className="rc-brand-logo"
          />
          <div>
            <p className="rc-brand-eyebrow">{BASEINFRA_THEME.brandFullName}</p>
            <h3>{metadados.tituloRelatorio || BASEINFRA_THEME.tituloPadraoRelatorio}</h3>
          </div>
        </div>
        <div className="rc-header-logos">
          {metadados.logoConcessionariaDataUrl || metadados.logoConcessionariaUrl ? (
            <img
              src={metadados.logoConcessionariaDataUrl || metadados.logoConcessionariaUrl || ''}
              alt={`Logotipo ${metadados.nomeConcessionaria || 'da concessionária'}`}
              className="rc-conc-logo"
            />
          ) : (
            <div className="rc-conc-placeholder" aria-label="Sem logotipo da concessionária">
              {metadados.nomeConcessionaria || 'Concessionária'}
            </div>
          )}
        </div>
      </header>

      <div className="rc-meta-bar">
        <div>
          <span className="rc-meta-label">Projeto</span>
          <strong>{payload.metadados.nomeProjeto}</strong>
        </div>
        <div>
          <span className="rc-meta-label">Concessionária</span>
          <strong>{payload.metadados.nomeConcessionaria || '—'}</strong>
        </div>
        <div>
          <span className="rc-meta-label">Trecho / rodovia</span>
          <strong>{payload.metadados.trechoRodovia || '—'}</strong>
        </div>
        <div>
          <span className="rc-meta-label">Análise</span>
          <strong>{formatDateTimeBr(payload.analisadoEm)}</strong>
        </div>
        <div>
          <span className="rc-meta-label">ID do relatório</span>
          <strong>{payload.identificadorRelatorio}</strong>
        </div>
        <div>
          <span className="rc-meta-label">Responsável</span>
          <strong>{payload.metadados.responsavel || '—'}</strong>
        </div>
      </div>

      <div className="rc-summary-row">
        <div className={statusClass} role="status">
          <Shield size={18} aria-hidden />
          <div>
            <span>Status geral</span>
            <strong>{STATUS_CONFORMIDADE_LABELS[payload.statusGeral]}</strong>
          </div>
        </div>
        <div className="rc-percent">
          <span>Índice de conformidade</span>
          <strong>{formatPercent(payload.indicadores.percentualConformidade)}</strong>
        </div>
        <div className="rc-stat rc-stat-ok">
          <CheckCircle2 size={16} aria-hidden />
          <span>{payload.indicadores.conformes}</span>
          <small>Conformes</small>
        </div>
        <div className="rc-stat rc-stat-warn">
          <AlertTriangle size={16} aria-hidden />
          <span>{payload.indicadores.exigemAtencao + payload.indicadores.parcialmenteConformes}</span>
          <small>Exigem atenção</small>
        </div>
        <div className="rc-stat rc-stat-danger">
          <X size={16} aria-hidden />
          <span>{payload.indicadores.naoConformes}</span>
          <small>Não conformes</small>
        </div>
        <div className="rc-stat rc-stat-neutral">
          <span>{payload.indicadores.naoAvaliados}</span>
          <small>Não avaliados</small>
        </div>
      </div>

      <div className="rc-actions" role="toolbar" aria-label="Ações do relatório">
        <button
          type="button"
          className={`rc-btn ${mode === 'preview' ? 'rc-btn-primary' : 'rc-btn-ghost'}`}
          onClick={() => setMode('preview')}
        >
          <Eye size={16} />
          Visualizar relatório
        </button>
        <button
          type="button"
          className={`rc-btn ${mode === 'edit' ? 'rc-btn-primary' : 'rc-btn-ghost'}`}
          onClick={() => setMode('edit')}
        >
          <Pencil size={16} />
          Editar informações
        </button>
        <button
          type="button"
          className="rc-btn rc-btn-ghost"
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo || gerando}
        >
          {uploadingLogo ? <Loader2 size={16} className="rc-spin" /> : <ImagePlus size={16} />}
          Selecionar ou enviar logotipo
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="rc-file-input"
          onChange={handleLogoChange}
          aria-label="Enviar logotipo da concessionária"
        />
        <button
          type="button"
          className="rc-btn rc-btn-accent"
          onClick={handleGerar}
          disabled={gerando}
          aria-busy={gerando}
        >
          {gerando ? <Loader2 size={16} className="rc-spin" /> : <FileDown size={16} />}
          {gerando ? 'Gerando PDF...' : ultimoGerado ? 'Gerar novamente' : 'Gerar PDF'}
        </button>
        <button
          type="button"
          className="rc-btn rc-btn-primary"
          onClick={() => handleBaixar()}
          disabled={gerando || !ultimoGerado}
        >
          <Download size={16} />
          Baixar PDF
        </button>
      </div>

      {erro && (
        <div className="rc-alert rc-alert-error" role="alert">
          <p>{erro}</p>
          <button type="button" className="rc-btn rc-btn-ghost" onClick={handleGerar} disabled={gerando}>
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      )}
      {sucesso && (
        <div className="rc-alert rc-alert-success" role="status">
          {sucesso}
        </div>
      )}
      {ultimoGerado && (
        <div className="rc-alert rc-alert-success" role="status">
          Arquivo baixado com logos BaseInfra
          {getLogoConcessionariaPath(metadados.nomeConcessionaria, props.concessionariaId)
            ? ` e ${metadados.nomeConcessionaria || 'concessionária'}`
            : ''}
          . Título: Relatório de Análise Técnica – Ocupação em Faixa de Domínio.
        </div>
      )}

      {mode === 'edit' ? (
        <section className="rc-editor" aria-label="Editar informações do relatório">
          <p className="rc-editor-hint">
            Alterações afetam apenas a apresentação do relatório. O resultado original da análise
            pela IA permanece preservado.
          </p>
          <div className="rc-editor-grid">
            <label>
              Título do relatório
              <input
                value={metadados.tituloRelatorio}
                onChange={(e) => updateField('tituloRelatorio', e.target.value)}
              />
            </label>
            <label>
              Nome do projeto
              <input
                value={metadados.nomeProjeto}
                onChange={(e) => updateField('nomeProjeto', e.target.value)}
              />
            </label>
            <label>
              Número do contrato
              <input
                value={metadados.numeroContrato}
                onChange={(e) => updateField('numeroContrato', e.target.value)}
              />
            </label>
            <label>
              Nome da concessionária
              <input
                value={metadados.nomeConcessionaria}
                onChange={(e) => updateField('nomeConcessionaria', e.target.value)}
              />
            </label>
            <label>
              Trecho ou rodovia
              <input
                value={metadados.trechoRodovia}
                onChange={(e) => updateField('trechoRodovia', e.target.value)}
              />
            </label>
            <label>
              Responsável
              <input
                value={metadados.responsavel}
                onChange={(e) => updateField('responsavel', e.target.value)}
              />
            </label>
            <label>
              Data de referência
              <input
                type="datetime-local"
                value={toLocalInputValue(metadados.dataReferencia)}
                onChange={(e) =>
                  updateField(
                    'dataReferencia',
                    e.target.value ? new Date(e.target.value).toISOString() : metadados.dataReferencia,
                  )
                }
              />
            </label>
            <label>
              Classificação de confidencialidade
              <select
                value={metadados.classificacaoConfidencialidade}
                onChange={(e) =>
                  updateField(
                    'classificacaoConfidencialidade',
                    e.target.value as RelatorioMetadadosEditaveis['classificacaoConfidencialidade'],
                  )
                }
              >
                {Object.entries(CONFIDENCIALIDADE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="rc-editor-full">
              Observações
              <textarea
                rows={3}
                value={metadados.observacoes}
                onChange={(e) => updateField('observacoes', e.target.value)}
              />
            </label>
          </div>
        </section>
      ) : (
        <section className="rc-preview" aria-label="Pré-visualização do relatório">
          <article className="rc-preview-card rc-preview-parecer">
            <h4>Parecer técnico (conteúdo do PDF)</h4>
            {props.parecerTecnico?.trim() ? (
              <pre className="rc-parecer-text">{props.parecerTecnico}</pre>
            ) : (
              <>
                <p>
                  <strong>Objetivo:</strong> {payload.resumoExecutivo.objetivo}
                </p>
                <p>
                  <strong>Escopo:</strong> {payload.resumoExecutivo.escopo}
                </p>
                <div className="rc-preview-lists">
                  <div>
                    <h5>Conclusões</h5>
                    <ul>
                      {payload.resumoExecutivo.principaisConclusoes.map((item) => (
                        <li key={item.slice(0, 40)}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5>Riscos</h5>
                    <ul>
                      {payload.resumoExecutivo.principaisRiscos.map((item) => (
                        <li key={item.slice(0, 40)}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5>Recomendações prioritárias</h5>
                    <ul>
                      {payload.resumoExecutivo.recomendacoesPrioritarias.map((item) => (
                        <li key={item.slice(0, 40)}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="rc-preview-card">
            <h4>Verificações detalhadas</h4>
            <div className="rc-items">
              {payload.itens.map((item) => (
                <div key={item.codigo} className={`rc-item rc-item-${item.status}`}>
                  <header>
                    <span className={`rc-badge rc-badge-${item.status}`}>
                      {STATUS_CONFORMIDADE_LABELS[item.status]}
                    </span>
                    <strong>
                      {item.codigo} — {item.titulo}
                    </strong>
                    <span className={`rc-crit rc-crit-${item.criticidade}`}>
                      Criticidade: {item.criticidade}
                    </span>
                  </header>
                  <p>
                    <span>Evidências:</span> {item.evidencias}
                  </p>
                  <p>
                    <span>Justificativa IA:</span> {item.justificativaIa}
                  </p>
                  <p>
                    <span>Recomendação:</span> {item.recomendacao}
                  </p>
                  <p>
                    <span>Referência:</span> {item.referenciaNormativa}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {payload.planoAcao.length > 0 && (
            <article className="rc-preview-card">
              <h4>Plano de ação</h4>
              <div className="rc-table-wrap">
                <table className="rc-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Ação</th>
                      <th>Prioridade</th>
                      <th>Responsável</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.planoAcao.map((acao) => (
                      <tr key={`${acao.itemCodigo}-${acao.acaoRecomendada.slice(0, 20)}`}>
                        <td>{acao.itemCodigo}</td>
                        <td>{acao.acaoRecomendada}</td>
                        <td>{acao.prioridade}</td>
                        <td>{acao.responsavel || '—'}</td>
                        <td>{acao.statusTratamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </section>
      )}

      <section className="rc-history" aria-label="Histórico de PDFs">
        <header>
          <History size={16} />
          <h4>Histórico de relatórios gerados</h4>
        </header>
        {historico.length === 0 ? (
          <p className="rc-history-empty">Nenhum PDF gerado ainda para esta análise.</p>
        ) : (
          <ul className="rc-history-list">
            {historico.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>v{item.versao}</strong> — {item.fileName}
                  <small>
                    {formatDateTimeBr(item.geradoEm)}
                    {item.geradoPorNome ? ` · ${item.geradoPorNome}` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="rc-btn rc-btn-ghost"
                  onClick={() => handleBaixar(item.id, item.fileName)}
                >
                  <Download size={14} />
                  Baixar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="rc-footer">
        <span>
          {CONFIDENCIALIDADE_LABELS[payload.metadados.classificacaoConfidencialidade]} —{' '}
          {BASEINFRA_THEME.confidentialityDefault}
        </span>
        <span>
          Resultado original da IA preservado · Edição limitada aos metadados de apresentação
        </span>
      </footer>
    </div>
  )
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
