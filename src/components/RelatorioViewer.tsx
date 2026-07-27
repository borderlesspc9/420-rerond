import { useEffect, useState } from 'react'
import { X, ClipboardList, FileText, Copy, Printer, FileOutput } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChecklistReportView from './ChecklistReportView'
import ChecklistConformidadeView from './ChecklistConformidadeView'
import RelatorioConformidadeView from './RelatorioConformidadeView'
import AnaliseProgressOverlay from './AnaliseProgressOverlay'
import type { ComplementoChecklistItem, ConferenciaInput, DadosExtraidosAnalise, SolicitacaoWithFiles, TipoRelatorio } from '../models/Solicitacao'
import { formatarRelatorioComplementos } from '../services/solicitacao/solicitacaoService'
import {
  getTipoProjetoNome,
  parseComplementosChecklist,
  parseConformidadeChecklist,
} from '../utils/checklistConformidade'
import './RelatorioViewer.css'

const CHECKLIST_KEYS = [
  'LOCALIZACAO', 'KM_INICIO', 'KM_FIM', 'NOME_BR',
  'COORDENADAS_GEORREFERENCIAIS_E', 'COORDENADAS_GEORREFERENCIAIS_N',
  'TRACADO_FAIXA_DOMINIO', 'COTAS_TEXTOS_LEGIVEIS', 'VERIFICACAO_ESCALA',
  'MEMORIAL', 'LARGURA_PISTA_DNIT', 'LEGENDAS', 'ANOTACAO_NOTA',
  'SIGLA_ABREVIACAO', 'LOC_KM_PREFIXO', 'CARIMBO_CORRETO',
  'LIMITE_PROPRIEDADE', 'DELIMITACAO_DOMINIO_NAO_EDIFICANTE', 'ART_PDF', 'QTD_FOLHAS',
]

function parseChecklistJson(raw: string): Record<string, string> | null {
  const trimmed = raw.trim()
  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        data = JSON.parse(match[0])
      } catch {
        return null
      }
    } else {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>

  if (Array.isArray(obj.itens)) {
    const normalized: Record<string, string> = {}

    for (const item of obj.itens as Array<Record<string, unknown>>) {
      const nomeItem = String(item.item ?? '').trim()
      const status = String(item.status ?? '').trim().toUpperCase()
      if (!nomeItem) continue

      if (status === 'OK') {
        normalized[nomeItem] = 'ok'
        continue
      }

      const onde = String(item.onde_esta_errado ?? '').trim()
      const porQue = String(item.por_que_esta_errado ?? '').trim()
      const referencia = String(item.referencia_normativa ?? '').trim()
      const detalhes = [onde, porQue, referencia].filter(Boolean).join(' | ')

      normalized[nomeItem] = detalhes
        ? `informações não batem; ${detalhes}`
        : 'informações não batem'
    }

    return Object.keys(normalized).length ? normalized : null
  }

  const hasKey = CHECKLIST_KEYS.some((k) => k in obj)
  if (!hasKey) return null
  const out: Record<string, string> = {}
  for (const key of CHECKLIST_KEYS) {
    if (key in obj && (obj[key] === null || typeof obj[key] === 'string' || typeof obj[key] === 'number')) {
      out[key] = String(obj[key] ?? '')
    }
  }
  return Object.keys(out).length ? out : null
}

type TabId = 'parecer' | 'checklist' | 'relatorio'

interface RelatorioViewerProps {
  relatorio: string
  titulo: string
  onClose: () => void
  solicitacaoId?: string
  solicitacaoInfo?: {
    localizacao?: string
    tipoObra?: string
    descricao?: string
    nomeConcessionaria?: string | null
    nroProcessoErp?: string | null
    rodovia?: string | null
    kilometragem?: string | null
    responsavelTecnico?: string | null
    analistaResponsavel?: string | null
    cliente?: string | null
    analisadoEm?: Date | string | null
  }
  parecerTecnico?: string
  checklistConformidade?: string
  complementosChecklist?: string
  tipoRelatorio?: TipoRelatorio
  concessionariaId?: string | null
  dadosExtraidos?: DadosExtraidosAnalise | null
  conferenciaInputs?: ConferenciaInput[]
  onRelatorioAtualizado?: (resultado: SolicitacaoWithFiles) => void
  initialTab?: TabId
}

export default function RelatorioViewer({
  relatorio,
  titulo,
  onClose,
  solicitacaoId,
  solicitacaoInfo,
  parecerTecnico,
  checklistConformidade,
  complementosChecklist,
  tipoRelatorio,
  concessionariaId,
  dadosExtraidos,
  conferenciaInputs,
  onRelatorioAtualizado,
  initialTab,
}: RelatorioViewerProps) {
  const [parecerAtual, setParecerAtual] = useState(parecerTecnico)
  const [dadosExtraidosAtual, setDadosExtraidosAtual] = useState(dadosExtraidos)
  const [conferenciaAtual, setConferenciaAtual] = useState(conferenciaInputs)
  const [copiado, setCopiado] = useState(false)
  const [checklistAtual, setChecklistAtual] = useState(checklistConformidade)
  const [complementosAtual, setComplementosAtual] = useState(complementosChecklist)
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState<string | null>(null)

  useEffect(() => {
    setParecerAtual(parecerTecnico)
    setChecklistAtual(checklistConformidade)
    setComplementosAtual(complementosChecklist)
    setDadosExtraidosAtual(dadosExtraidos)
    setConferenciaAtual(conferenciaInputs)
  }, [parecerTecnico, checklistConformidade, complementosChecklist, dadosExtraidos, conferenciaInputs])

  const conformidadeItems = checklistAtual
    ? parseConformidadeChecklist(checklistAtual)
    : null
  const hasConformidade = !!conformidadeItems && conformidadeItems.length > 0
  const hasParecer = !!parecerAtual
  const hasRelatorioPdf = hasConformidade && !!solicitacaoId

  const hasDualView = hasConformidade && hasParecer
  const defaultTab: TabId = initialTab
    ? initialTab
    : hasRelatorioPdf
      ? 'relatorio'
      : hasParecer
        ? 'parecer'
        : 'checklist'
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    } else if (hasRelatorioPdf) {
      setActiveTab('relatorio')
    }
  }, [initialTab, hasRelatorioPdf, solicitacaoId])

  const legacyChecklistData = !hasParecer && !hasConformidade
    ? parseChecklistJson(relatorio)
    : null
  const isLegacyChecklist = legacyChecklistData !== null

  const tipoProjetoNome = getTipoProjetoNome(tipoRelatorio)
  const complementosIniciais = parseComplementosChecklist(complementosAtual)
  const podeComplementar = !!solicitacaoId && hasConformidade

  const handleCopiarParecer = async () => {
    if (!parecerAtual) return
    try {
      await navigator.clipboard.writeText(parecerAtual)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // fallback silencioso
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  const renderConferenciaStatus = (status: ConferenciaInput['status']) => {
    const labels: Record<ConferenciaInput['status'], string> = {
      COMPATIVEL: 'Compatível',
      DIVERGENTE: 'Divergente',
      AUSENTE_NO_DOCUMENTO: 'Ausente no documento',
      AUSENTE_NO_FORMULARIO: 'Ausente no formulário',
    }
    return labels[status] ?? status
  }

  const renderDadosExtraidos = () => {
    if (!dadosExtraidosAtual) return null
    const entries = Object.entries(dadosExtraidosAtual).filter(([, v]) => v)
    if (entries.length === 0) return null

    return (
      <details className="relatorio-extra-section" open>
        <summary>Dados extraídos dos documentos</summary>
        <dl className="relatorio-extra-dl">
          {entries.map(([key, value]) => (
            <div key={key} className="relatorio-extra-row">
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
    )
  }

  const renderConferenciaInputs = () => {
    if (!conferenciaAtual?.length) return null

    return (
      <details className="relatorio-extra-section" open>
        <summary>Conferência entre formulário e documentos</summary>
        <div className="relatorio-conferencia-list">
          {conferenciaAtual.map((item) => (
            <div key={item.campo} className={`relatorio-conferencia-item status-${item.status.toLowerCase()}`}>
              <strong>{item.campo}</strong>
              <span className="relatorio-conferencia-status">{renderConferenciaStatus(item.status)}</span>
              <p>Formulário: {item.valorFormulario ?? '—'}</p>
              <p>Documento: {item.valorDocumento ?? '—'}</p>
              {item.observacao && <p className="relatorio-conferencia-obs">{item.observacao}</p>}
            </div>
          ))}
        </div>
      </details>
    )
  }

  const renderParecerContent = () => (
    <>
      {renderDadosExtraidos()}
      {renderConferenciaInputs()}
      {hasParecer && (
        <div className="relatorio-parecer-actions">
          <button type="button" className="relatorio-action-btn" onClick={handleCopiarParecer}>
            <Copy size={16} />
            {copiado ? 'Copiado!' : 'Copiar parecer'}
          </button>
          <button type="button" className="relatorio-action-btn" onClick={handleImprimir}>
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      )}
      {parecerAtual && <ReactMarkdown remarkPlugins={[remarkGfm]}>{parecerAtual}</ReactMarkdown>}
    </>
  )

  const handleGerarRelatorio = async (complementos: ComplementoChecklistItem[]) => {
    if (!solicitacaoId) return

    setGerando(true)
    setErroGeracao(null)

    try {
      const resultado = await formatarRelatorioComplementos(solicitacaoId, complementos)
      setParecerAtual(resultado.parecerTecnico)
      setChecklistAtual(resultado.checklistConformidade)
      setComplementosAtual(resultado.complementosChecklist)
      setDadosExtraidosAtual(resultado.dadosExtraidos)
      setConferenciaAtual(resultado.conferenciaInputs)
      setActiveTab('relatorio')
      onRelatorioAtualizado?.(resultado)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar relatório com complementos.'
      setErroGeracao(message)
    } finally {
      setGerando(false)
    }
  }

  const showTabs = hasDualView || hasRelatorioPdf

  const renderRelatorioPdf = () => {
    if (!hasRelatorioPdf || !conformidadeItems) return null
    return (
      <RelatorioConformidadeView
        solicitacaoId={solicitacaoId!}
        titulo={titulo}
        checklistItems={conformidadeItems}
        checklistConformidadeRaw={checklistAtual}
        parecerTecnico={parecerAtual}
        relatorioIA={relatorio}
        tipoRelatorio={tipoRelatorio}
        concessionariaId={concessionariaId}
        nomeConcessionaria={solicitacaoInfo?.nomeConcessionaria}
        nroProcessoErp={solicitacaoInfo?.nroProcessoErp}
        rodovia={solicitacaoInfo?.rodovia}
        kilometragem={solicitacaoInfo?.kilometragem}
        localizacao={solicitacaoInfo?.localizacao}
        descricao={solicitacaoInfo?.descricao}
        tipoObra={solicitacaoInfo?.tipoObra}
        responsavelTecnico={solicitacaoInfo?.responsavelTecnico}
        analistaResponsavel={solicitacaoInfo?.analistaResponsavel}
        cliente={solicitacaoInfo?.cliente}
        analisadoEm={solicitacaoInfo?.analisadoEm}
        dadosExtraidos={dadosExtraidosAtual}
        conferenciaInputs={conferenciaAtual}
      />
    )
  }

  return (
    <div className="relatorio-viewer-overlay" onClick={onClose}>
      <AnaliseProgressOverlay
        active={gerando}
        titulo={titulo}
        nomeConcessionaria={solicitacaoInfo?.nomeConcessionaria}
        concessionariaId={concessionariaId}
      />
      <div
        className={`relatorio-viewer-container ${hasConformidade ? 'relatorio-viewer-container-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relatorio-viewer-header">
          <div className="relatorio-viewer-heading">
            <h2>Análise de Conformidade</h2>
            <p className="relatorio-viewer-subtitulo">{titulo}</p>
            {tipoProjetoNome && (
              <span className="relatorio-viewer-tipo">{tipoProjetoNome}</span>
            )}
          </div>
          <button className="relatorio-viewer-close" onClick={onClose} aria-label="Fechar">
            <X size={24} />
          </button>
        </div>

        {showTabs && (
          <div className="relatorio-tabs" role="tablist">
            {hasRelatorioPdf && (
              <button
                role="tab"
                aria-selected={activeTab === 'relatorio'}
                className={`relatorio-tab ${activeTab === 'relatorio' ? 'relatorio-tab-active' : ''}`}
                onClick={() => setActiveTab('relatorio')}
              >
                <FileOutput size={16} />
                Relatório PDF
              </button>
            )}
            {hasParecer && (
              <button
                role="tab"
                aria-selected={activeTab === 'parecer'}
                className={`relatorio-tab ${activeTab === 'parecer' ? 'relatorio-tab-active' : ''}`}
                onClick={() => setActiveTab('parecer')}
              >
                <FileText size={16} />
                Parecer Técnico
              </button>
            )}
            {hasConformidade && (
              <button
                role="tab"
                aria-selected={activeTab === 'checklist'}
                className={`relatorio-tab ${activeTab === 'checklist' ? 'relatorio-tab-active' : ''}`}
                onClick={() => setActiveTab('checklist')}
              >
                <ClipboardList size={16} />
                Checklist de Conformidade
              </button>
            )}
          </div>
        )}

        <div className="relatorio-viewer-content">
          {showTabs ? (
            activeTab === 'relatorio' ? (
              renderRelatorioPdf()
            ) : activeTab === 'parecer' ? (
              renderParecerContent()
            ) : (
              <ChecklistConformidadeView
                items={conformidadeItems!}
                tipoRelatorio={tipoRelatorio}
                concessionariaId={concessionariaId}
                editavel={podeComplementar}
                complementosIniciais={complementosIniciais}
                gerando={gerando}
                erroGeracao={erroGeracao}
                onGerarRelatorio={handleGerarRelatorio}
              />
            )
          ) : hasParecer ? (
            renderParecerContent()
          ) : hasConformidade ? (
            <>
              {renderRelatorioPdf()}
              <ChecklistConformidadeView
                items={conformidadeItems!}
                tipoRelatorio={tipoRelatorio}
                concessionariaId={concessionariaId}
                editavel={podeComplementar}
                complementosIniciais={complementosIniciais}
                gerando={gerando}
                erroGeracao={erroGeracao}
                onGerarRelatorio={handleGerarRelatorio}
              />
            </>
          ) : isLegacyChecklist ? (
            <ChecklistReportView
              data={legacyChecklistData}
              titulo={titulo}
              localizacao={solicitacaoInfo?.localizacao}
              tipoObra={solicitacaoInfo?.tipoObra}
              descricao={solicitacaoInfo?.descricao}
            />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{relatorio}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
