import { useState } from 'react'
import { X, ClipboardList, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChecklistReportView from './ChecklistReportView'
import type { ChecklistItem } from '../models/Solicitacao'
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

function parseConformidadeChecklist(raw: string): ChecklistItem[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (parsed.length === 0) return null
    if (!parsed[0].item || !parsed[0].status) return null
    return parsed as ChecklistItem[]
  } catch {
    return null
  }
}

function ChecklistConformidadeTable({ items }: { items: ChecklistItem[] }) {
  const statusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return <span className="conformidade-badge conformidade-ok">OK</span>
      case 'NAO_CONFORME':
        return <span className="conformidade-badge conformidade-nao-conforme">Não Conforme</span>
      case 'INFORMACAO_AUSENTE':
        return <span className="conformidade-badge conformidade-ausente">Info Ausente</span>
      default:
        return <span className="conformidade-badge">{status}</span>
    }
  }

  const okItems = items.filter(i => i.status === 'OK')
  const naoConformeItems = items.filter(i => i.status === 'NAO_CONFORME')
  const ausenteItems = items.filter(i => i.status === 'INFORMACAO_AUSENTE')

  return (
    <div className="conformidade-checklist">
      <div className="conformidade-summary">
        <div className="conformidade-stat conformidade-stat-ok">
          <span className="conformidade-stat-number">{okItems.length}</span>
          <span className="conformidade-stat-label">Conformes</span>
        </div>
        <div className="conformidade-stat conformidade-stat-nao">
          <span className="conformidade-stat-number">{naoConformeItems.length}</span>
          <span className="conformidade-stat-label">Não Conformes</span>
        </div>
        <div className="conformidade-stat conformidade-stat-ausente">
          <span className="conformidade-stat-number">{ausenteItems.length}</span>
          <span className="conformidade-stat-label">Info Ausente</span>
        </div>
      </div>

      <table className="conformidade-table">
        <thead>
          <tr>
            <th>Requisito</th>
            <th>Status</th>
            <th>Fundamentação</th>
            <th>Orientação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className={`conformidade-row conformidade-row-${item.status.toLowerCase().replace('_', '-')}`}>
              <td>
                <strong>{item.item.replace(/_/g, ' ')}</strong>
                {item.situacaoEncontrada && (
                  <div className="conformidade-detalhe">{item.situacaoEncontrada}</div>
                )}
              </td>
              <td>{statusBadge(item.status)}</td>
              <td className="conformidade-fundamentacao">{item.fundamentacao || '—'}</td>
              <td className="conformidade-orientacao">{item.orientacao || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type TabId = 'parecer' | 'checklist'

interface RelatorioViewerProps {
  relatorio: string
  titulo: string
  onClose: () => void
  solicitacaoInfo?: { localizacao?: string; tipoObra?: string; descricao?: string }
  parecerTecnico?: string
  checklistConformidade?: string
}

export default function RelatorioViewer({
  relatorio,
  titulo,
  onClose,
  solicitacaoInfo,
  parecerTecnico,
  checklistConformidade,
}: RelatorioViewerProps) {
  const conformidadeItems = checklistConformidade
    ? parseConformidadeChecklist(checklistConformidade)
    : null
  const hasConformidade = !!conformidadeItems && conformidadeItems.length > 0
  const hasParecer = !!parecerTecnico

  const hasDualView = hasConformidade && hasParecer
  const [activeTab, setActiveTab] = useState<TabId>(hasParecer ? 'parecer' : 'checklist')

  const legacyChecklistData = !hasParecer && !hasConformidade
    ? parseChecklistJson(relatorio)
    : null
  const isLegacyChecklist = legacyChecklistData !== null

  return (
    <div className="relatorio-viewer-overlay" onClick={onClose}>
      <div className="relatorio-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="relatorio-viewer-header">
          <h2>Relatório de Conformidade - {titulo}</h2>
          <button className="relatorio-viewer-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {hasDualView && (
          <div className="relatorio-tabs">
            <button
              className={`relatorio-tab ${activeTab === 'parecer' ? 'relatorio-tab-active' : ''}`}
              onClick={() => setActiveTab('parecer')}
            >
              <FileText size={16} />
              Parecer Técnico
            </button>
            <button
              className={`relatorio-tab ${activeTab === 'checklist' ? 'relatorio-tab-active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              <ClipboardList size={16} />
              Checklist de Conformidade
            </button>
          </div>
        )}

        <div className="relatorio-viewer-content">
          {hasDualView ? (
            activeTab === 'parecer' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{parecerTecnico!}</ReactMarkdown>
            ) : (
              <ChecklistConformidadeTable items={conformidadeItems!} />
            )
          ) : hasParecer ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{parecerTecnico!}</ReactMarkdown>
          ) : hasConformidade ? (
            <ChecklistConformidadeTable items={conformidadeItems!} />
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
