export type TipoRelatorio = 'pit' | 'obra_per' | 'obra_nao_per'

export interface ChecklistItem {
  item: string
  status: 'OK' | 'NAO_CONFORME' | 'INFORMACAO_AUSENTE'
  situacaoEncontrada: string
  exigenciaNormativa: string
  fundamentacao: string
  orientacao: string
}

export interface Solicitacao {
  id?: string
  titulo: string
  tipoObra: string
  localizacao: string
  descricao: string
  arquivos?: string[]
  status?: 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada'
  relatorioIA?: string
  analisadoPorIA?: boolean
  analisadoEm?: Date
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  tipoRelatorio?: TipoRelatorio
  parecerTecnico?: string
  checklistConformidade?: string
  // Overview Dados do cliente
  cliente?: string
  kilometragem?: string
  nroProcessoErp?: string
  rodovia?: string
  nomeConcessionaria?: string
  sentido?: string
  ocupacao?: string
  municipioEstado?: string
  ocupacaoArea?: string
  responsavelTecnico?: string
  faseProjeto?: string
  analistaResponsavel?: string
  memorial?: string
  dataRecebimento?: string
  numeroRevisao?: string
}

export interface SolicitacaoWithFiles extends Solicitacao {
  arquivosUrls?: string[]
}
