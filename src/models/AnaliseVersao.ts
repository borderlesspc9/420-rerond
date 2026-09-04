export type AnaliseVersao = {
  id: string
  solicitacaoId: string
  versao: number
  jobId?: string | null
  tipoAnaliseId?: string | null
  tipoRelatorio?: string | null
  parecerTecnico?: string | null
  checklistConformidade?: string | null
  relatorioIA?: string | null
  promptCustomizado?: string | null
  createdAt?: Date
}
