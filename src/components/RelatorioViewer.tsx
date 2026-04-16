import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChecklistReportView from './ChecklistReportView'
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

  // Novo formato de conformidade normativa
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

interface RelatorioViewerProps {
  relatorio: string
  titulo: string
  onClose: () => void
  solicitacaoInfo?: { localizacao?: string; tipoObra?: string; descricao?: string }
}

export default function RelatorioViewer({ relatorio, titulo, onClose, solicitacaoInfo }: RelatorioViewerProps) {
  const checklistData = parseChecklistJson(relatorio)
  const isChecklist = checklistData !== null

  return (
    <div className="relatorio-viewer-overlay" onClick={onClose}>
      <div className="relatorio-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="relatorio-viewer-header">
          <h2>{isChecklist ? 'Checklist de Análise' : 'Relatório de Análise'} - {titulo}</h2>
          <button className="relatorio-viewer-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="relatorio-viewer-content">
          {isChecklist ? (
            <ChecklistReportView
              data={checklistData}
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
