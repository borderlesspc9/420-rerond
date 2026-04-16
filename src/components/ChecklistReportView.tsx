import './ChecklistReportView.css'

const CHECKLIST_LABELS: Record<string, string> = {
  LOCALIZACAO: 'Localização do acesso conforme SRE vigente',
  KM_INICIO: 'KM+M do início (eixo do acesso)',
  KM_FIM: 'KM+M do final (eixo do acesso)',
  NOME_BR: 'Identificação da BR',
  COORDENADAS_GEORREFERENCIAIS_E: 'Coordenadas georreferenciais (E)',
  COORDENADAS_GEORREFERENCIAIS_N: 'Coordenadas georreferenciais (N)',
  TRACADO_FAIXA_DOMINIO: 'Traçado em faixa de domínio',
  COTAS_TEXTOS_LEGIVEIS: 'Cotas e textos legíveis',
  VERIFICACAO_ESCALA: 'Verificação de escala',
  MEMORIAL: 'Memorial descritivo',
  LARGURA_PISTA_DNIT: 'Largura de pista (padrão DNIT)',
  LEGENDAS: 'Legendação',
  ANOTACAO_NOTA: 'Anotação / Nota',
  SIGLA_ABREVIACAO: 'Siglas e abreviações',
  LOC_KM_PREFIXO: 'Localização km + prefixo',
  CARIMBO_CORRETO: 'Carimbo correto',
  LIMITE_PROPRIEDADE: 'Limite de propriedade',
  DELIMITACAO_DOMINIO_NAO_EDIFICANTE: 'Delimitação domínio não edificante',
  ART_PDF: 'ART em PDF',
  QTD_FOLHAS: 'Quantidade de folhas',
}

const CHECKLIST_ORDER = [
  'LOCALIZACAO', 'KM_INICIO', 'KM_FIM', 'NOME_BR',
  'COORDENADAS_GEORREFERENCIAIS_E', 'COORDENADAS_GEORREFERENCIAIS_N',
  'TRACADO_FAIXA_DOMINIO', 'COTAS_TEXTOS_LEGIVEIS', 'VERIFICACAO_ESCALA',
  'MEMORIAL', 'LARGURA_PISTA_DNIT', 'LEGENDAS', 'ANOTACAO_NOTA',
  'SIGLA_ABREVIACAO', 'LOC_KM_PREFIXO', 'CARIMBO_CORRETO',
  'LIMITE_PROPRIEDADE', 'DELIMITACAO_DOMINIO_NAO_EDIFICANTE', 'ART_PDF', 'QTD_FOLHAS',
]

function formatDynamicLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function isAprovado(val: string): boolean {
  if (!val || typeof val !== 'string') return false
  const v = val.toLowerCase().trim()
  return v === 'aprovado' || v === 'conforme' || v === 'ok' || v === 'sim' || v === 'presente'
}

function isInformacoesNaoBatem(val: string): boolean {
  if (!val || typeof val !== 'string') return false
  return val.toLowerCase().trim().startsWith('informações não batem')
}

export interface ChecklistReportViewProps {
  data: Record<string, string>
  titulo: string
  localizacao?: string
  tipoObra?: string
  descricao?: string
}

export default function ChecklistReportView({
  data,
  titulo,
  localizacao,
  tipoObra,
  descricao,
}: ChecklistReportViewProps) {
  const dynamicKeys = Object.keys(data).filter((key) => !CHECKLIST_ORDER.includes(key))
  const orderedKeys = [...CHECKLIST_ORDER.filter((key) => key in data), ...dynamicKeys]

  const rows = orderedKeys.map((key, index) => {
    const value = String(data[key] ?? '').trim()
    const aprovado = isAprovado(value)
    const naoBatem = isInformacoesNaoBatem(value)
    const situacao = aprovado ? 'OK' : (value || '—')
    return {
      item: index + 1,
      documento: CHECKLIST_LABELS[key] || formatDynamicLabel(key),
      situacao,
      aprovado,
      naoBatem,
    }
  })

  return (
    <div className="checklist-report">
      <header className="checklist-report-header">
        <p className="checklist-report-empresa">BASEINFRA PROJETOS E CONSULTORIA</p>
        <h1 className="checklist-report-titulo">
          CHECKLIST DE DOCUMENTOS PARA PROCEDIMENTO DE SOLICITAÇÃO DE AUTORIZAÇÃO DE OCUPAÇÃO
        </h1>
      </header>

      <div className="checklist-report-protocolo">
        <span>Análise por IA</span>
        <span>Relatório de conformidade</span>
      </div>

      <div className="checklist-report-identificacao">
        <div className="checklist-report-campo">
          <span className="checklist-report-label">Título / Processo:</span>
          <span className="checklist-report-valor">{titulo}</span>
        </div>
        {localizacao && (
          <div className="checklist-report-campo">
            <span className="checklist-report-label">Localização:</span>
            <span className="checklist-report-valor">{localizacao}</span>
          </div>
        )}
        {tipoObra && (
          <div className="checklist-report-campo">
            <span className="checklist-report-label">Tipo de obra:</span>
            <span className="checklist-report-valor">{tipoObra}</span>
          </div>
        )}
        {descricao && (
          <div className="checklist-report-campo">
            <span className="checklist-report-label">Descrição:</span>
            <span className="checklist-report-valor">{descricao}</span>
          </div>
        )}
      </div>

      <div className="checklist-report-nota">
        <span className="checklist-report-nota-label">Nota:</span>
        <p>
          Itens analisados automaticamente pela IA. Comparação entre os dados do formulário e os PDFs anexados.
          OK = informações batem; "informações não batem" = divergência entre formulário e documentos.
        </p>
      </div>

      <table className="checklist-report-table">
        <thead>
          <tr>
            <th className="col-item">ITEM</th>
            <th className="col-documento">TIPO DO DOCUMENTO / PROJETO NECESSÁRIOS</th>
            <th className="col-situacao">SITUAÇÃO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item}>
              <td className="col-item">{row.item}</td>
              <td className="col-documento">{row.documento}</td>
              <td className="col-situacao">
                <span className={row.aprovado ? 'situacao-aprovado' : row.naoBatem ? 'situacao-nao-batem' : 'situacao-outro'}>
                  {row.situacao}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
