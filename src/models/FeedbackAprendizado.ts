export type FeedbackValidacaoStatus =
  | 'rascunho'
  | 'pendente'
  | 'aprovado'
  | 'rejeitado'

export type FeedbackAprendizado = {
  id: string
  solicitacaoId?: string | null
  tipoAnaliseId?: string | null
  organizacaoId?: string | null
  /** Item/regra do checklist ou trecho do parecer. */
  regraOuItem: string
  original: string
  correcao: string
  justificativa: string
  status: FeedbackValidacaoStatus
  autorId?: string | null
  autorNome?: string | null
  revisadoPorId?: string | null
  revisaoNota?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type FeedbackAprendizadoDraft = Omit<
  FeedbackAprendizado,
  'id' | 'createdAt' | 'updatedAt' | 'status'
> & {
  id?: string
  status?: FeedbackValidacaoStatus
}
