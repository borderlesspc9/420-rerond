import type { ChecklistItem, ConferenciaInput, DadosExtraidosAnalise, TipoRelatorio } from './Solicitacao'
import type { CriticidadeNivel } from '../config/baseinfraTheme'

export type StatusConformidadeItem =
  | 'conforme'
  | 'parcialmente_conforme'
  | 'nao_conforme'
  | 'exige_atencao'
  | 'nao_avaliado'

export type ClassificacaoConfidencialidade =
  | 'publico'
  | 'interno'
  | 'confidencial'
  | 'restrito'

export type StatusTratamentoAcao =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'nao_aplicavel'

export interface RelatorioMetadadosEditaveis {
  tituloRelatorio: string
  nomeProjeto: string
  numeroContrato: string
  nomeConcessionaria: string
  trechoRodovia: string
  responsavel: string
  observacoes: string
  dataReferencia: string
  classificacaoConfidencialidade: ClassificacaoConfidencialidade
  logoConcessionariaUrl?: string | null
  logoConcessionariaDataUrl?: string | null
}

export interface RelatorioItemDetalhe {
  codigo: string
  titulo: string
  descricao: string
  status: StatusConformidadeItem
  criticidade: CriticidadeNivel
  resultadoAnalise: string
  justificativaIa: string
  evidencias: string
  recomendacao: string
  referenciaNormativa: string
  observacoes: string
  categoria?: string
}

export interface RelatorioAcaoPlano {
  itemCodigo: string
  acaoRecomendada: string
  prioridade: CriticidadeNivel
  responsavel: string
  prazo: string
  statusTratamento: StatusTratamentoAcao
  observacoes: string
}

export interface RelatorioIndicadores {
  totalAnalisados: number
  conformes: number
  parcialmenteConformes: number
  naoConformes: number
  exigemAtencao: number
  naoAvaliados: number
  percentualConformidade: number
  porCriticidade: Record<CriticidadeNivel, number>
}

export interface RelatorioResumoExecutivo {
  objetivo: string
  escopo: string
  principaisConclusoes: string[]
  principaisRiscos: string[]
  recomendacoesPrioritarias: string[]
}

export interface RelatorioConformidadePayload {
  solicitacaoId: string
  reportId?: string
  versao?: number
  identificadorRelatorio: string
  statusGeral: StatusConformidadeItem
  analisadoEm: string
  geradoEm?: string
  geradoPorUid?: string | null
  geradoPorNome?: string | null
  metadados: RelatorioMetadadosEditaveis
  indicadores: RelatorioIndicadores
  resumoExecutivo: RelatorioResumoExecutivo
  itens: RelatorioItemDetalhe[]
  planoAcao: RelatorioAcaoPlano[]
  tipoRelatorio?: TipoRelatorio
  concessionariaId?: string | null
  /** Resultado original da IA — não deve ser alterado pela edição de apresentação */
  resultadoOriginalIa: {
    checklistConformidade?: string
    parecerTecnico?: string
    relatorioIA?: string
    dadosExtraidos?: DadosExtraidosAnalise | null
    conferenciaInputs?: ConferenciaInput[]
  }
}

export interface RelatorioPdfHistoricoItem {
  id: string
  solicitacaoId: string
  identificadorRelatorio: string
  versao: number
  fileName: string
  storagePath?: string
  downloadUrl?: string
  geradoEm: string
  geradoPorUid?: string | null
  geradoPorNome?: string | null
  nomeConcessionaria: string
  nomeProjeto: string
  percentualConformidade: number
  statusGeral: StatusConformidadeItem
}

export interface GerarRelatorioPdfResponse {
  reportId: string
  versao: number
  fileName: string
  downloadUrl: string
  identificadorRelatorio: string
  geradoEm: string
}

/** Fonte para montar o payload a partir da solicitação + análise */
export interface MontarRelatorioInput {
  solicitacaoId: string
  titulo: string
  tipoObra?: string
  localizacao?: string
  descricao?: string
  nomeConcessionaria?: string | null
  nroProcessoErp?: string | null
  rodovia?: string | null
  kilometragem?: string | null
  responsavelTecnico?: string | null
  analistaResponsavel?: string | null
  cliente?: string | null
  analisadoEm?: Date | string | null
  tipoRelatorio?: TipoRelatorio
  concessionariaId?: string | null
  checklistItems: ChecklistItem[]
  parecerTecnico?: string
  relatorioIA?: string
  checklistConformidadeRaw?: string
  dadosExtraidos?: DadosExtraidosAnalise | null
  conferenciaInputs?: ConferenciaInput[]
  usuarioAtual?: { uid?: string; displayName?: string | null; email?: string | null } | null
  metadadosOverrides?: Partial<RelatorioMetadadosEditaveis>
}
