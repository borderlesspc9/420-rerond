export type GoldenCase = {
  id: string
  codigo: string
  titulo: string
  tipoAnaliseId: string
  organizacaoId?: string | null
  descricao?: string
  /** Resumo do erro da IA (quando houver). */
  erroIa?: string
  /** Análise correta de referência. */
  analiseCorreta: string
  observacoes?: string
  /** URLs ou nomes de docs de referência (metadados). */
  documentosRef?: string[]
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type GoldenCaseDraft = Omit<GoldenCase, 'id' | 'createdAt' | 'updatedAt' | 'ativo'> & {
  id?: string
  ativo?: boolean
}
