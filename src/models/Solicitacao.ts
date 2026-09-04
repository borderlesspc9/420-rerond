export type TipoRelatorio = 'pit' | 'obra_per' | 'obra_nao_per'

export type TipoDocumentoAnexo =
  | 'requerimento'
  | 'memorial_descritivo'
  | 'plano_trabalho'
  | 'planta_baixa'
  | 'perfil_ocupacao'
  | 'projeto_sinalizacao'
  | 'art'
  | 'cronograma'
  | 'declaracao_veracidade'
  | 'licenca_ambiental'
  | 'parecer_concessionaria'
  | 'documento_complementar'
  | 'outro'
  | 'desconhecido'

export interface ArquivoMeta {
  url: string
  nome: string
  tipoDocumento: TipoDocumentoAnexo
  /** Preenchido quando tipoDocumento === 'outro'. */
  tipoDocumentoLabel?: string
  mimeType?: string
  tamanhoBytes?: number
  uploadedAt?: string
}

export interface EscopoAnalise {
  incluirDadosFormulario: boolean
  incluirDocumentosProjeto: boolean
  gerarChecklistConformidade: boolean
  gerarParecerTecnico: boolean
}

export interface ChecklistItem {
  item: string
  categoria?: string
  status: 'OK' | 'NAO_CONFORME' | 'INFORMACAO_AUSENTE'
  situacaoEncontrada: string
  exigenciaNormativa: string
  fundamentacao: string
  orientacao: string
}

export interface ComplementoChecklistItem {
  item: string
  texto: string
}

export interface DadosExtraidosAnalise {
  rodovia?: string | null
  kilometragem?: string | null
  municipio?: string | null
  uf?: string | null
  interessado?: string | null
  numeroArt?: string | null
  responsavelTecnico?: string | null
  extensao?: string | null
  tipoIntervencao?: string | null
}

export type StatusConferenciaInput =
  | 'COMPATIVEL'
  | 'DIVERGENTE'
  | 'AUSENTE_NO_DOCUMENTO'
  | 'AUSENTE_NO_FORMULARIO'

export interface ConferenciaInput {
  campo: string
  valorFormulario?: string | null
  valorDocumento?: string | null
  status: StatusConferenciaInput
  observacao?: string
  evidencia?: {
    arquivo?: string
    pagina?: string | null
    trecho?: string | null
  }
}

import type { AnaliseJobState } from './AnaliseJob'

export interface Solicitacao {
  id?: string
  titulo: string
  tipoObra: string
  localizacao: string
  descricao: string
  arquivos?: string[]
  arquivosMeta?: ArquivoMeta[]
  status?: 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada'
  analiseJobStatus?: AnaliseJobState
  analiseJobProgress?: number
  activeAnaliseJobId?: string | null
  relatorioIA?: string
  analisadoPorIA?: boolean
  analisadoEm?: Date
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  tipoRelatorio?: TipoRelatorio
  parecerTecnico?: string
  checklistConformidade?: string
  complementosChecklist?: string
  dadosExtraidos?: DadosExtraidosAnalise | null
  conferenciaInputs?: ConferenciaInput[]
  concessionariaId?: string | null
  /** Vínculo com cadastro persistente em `clientes` (Sprint 1). */
  clienteId?: string | null
  /** Vínculo com processo/atendimento (Sprint 2). */
  processoId?: string | null
  /** Tipo de análise isolado (ocupação, acesso, PAC, outro…). */
  tipoAnaliseId?: string | null
  /** Descrição livre quando tipoAnaliseId = outro / custom. */
  tipoAnaliseDescricao?: string | null
  /** Versão corrente da análise IA (snapshot em subcoleção). */
  analiseVersaoAtual?: number | null
  /** Histórico leve de edições manuais (P11). */
  historicoEdicoes?: Array<{
    em: string
    por?: string | null
    resumo: string
  }>
  // Overview Dados do cliente
  cliente?: string
  interessado?: string | null
  kilometragem?: string
  nroProcessoErp?: string
  rodovia?: string
  nomeConcessionaria?: string
  sentido?: string
  ocupacao?: string
  municipioEstado?: string
  uf?: string | null
  ocupacaoArea?: string
  responsavelTecnico?: string
  extensao?: string | null
  numeroArt?: string | null
  tipoIntervencaoDetalhado?: string | null
  faseProjeto?: string
  analistaResponsavel?: string
  memorial?: string
  dataRecebimento?: string
  numeroRevisao?: string
}

export interface SolicitacaoWithFiles extends Solicitacao {
  arquivosUrls?: string[]
}
