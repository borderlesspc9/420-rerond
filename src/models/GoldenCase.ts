export type GoldenCaseValidacaoStatus =
  | 'rascunho'
  | 'pendente'
  | 'aprovado'
  | 'rejeitado'

export type GoldenCasePar = {
  id: string
  /** Item/regra opcional (ex.: ART, afastamento). */
  regraOuItem?: string
  /** O que a IA fez/disse de errado. */
  original: string
  /** Como deveria ser. */
  correto: string
  justificativa: string
}

export type GoldenCaseDocumentoRef = {
  nome: string
  url?: string | null
  storagePath?: string | null
}

export type GoldenCase = {
  id: string
  codigo: string
  titulo: string
  tipoAnaliseId: string
  organizacaoId?: string | null
  descricao?: string
  /** Resumo legado do erro da IA (quando houver). */
  erroIa?: string
  /** Análise correta de referência (resumo). */
  analiseCorreta: string
  observacoes?: string
  /** Pares errado × certo (núcleo do ensino). */
  pares: GoldenCasePar[]
  documentosRef: GoldenCaseDocumentoRef[]
  status: GoldenCaseValidacaoStatus
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type GoldenCaseDraft = Omit<
  GoldenCase,
  'id' | 'createdAt' | 'updatedAt' | 'ativo' | 'status' | 'pares' | 'documentosRef'
> & {
  id?: string
  ativo?: boolean
  status?: GoldenCaseValidacaoStatus
  pares?: GoldenCasePar[]
  documentosRef?: GoldenCaseDocumentoRef[] | string[]
}
