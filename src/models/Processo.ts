export type ProcessoStatus =
  | 'aberto'
  | 'em_analise'
  | 'aguardando_revisao'
  | 'concluido'
  | 'arquivado'

export type Processo = {
  id: string
  codigo?: string | null
  titulo: string
  clienteId?: string | null
  clienteNome?: string | null
  concessionariaId?: string | null
  nomeConcessionaria?: string | null
  rodovia?: string | null
  status: ProcessoStatus
  revisaoAtual: string
  ultimaSolicitacaoId?: string | null
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type ProcessoDraft = {
  titulo: string
  clienteId?: string | null
  clienteNome?: string | null
  concessionariaId?: string | null
  nomeConcessionaria?: string | null
  rodovia?: string | null
  status?: ProcessoStatus
}

export function formatRevisao(index: number): string {
  const n = Math.max(0, Math.floor(index))
  return `R${String(n).padStart(2, '0')}`
}

export function nextRevisao(current?: string | null): string {
  const match = String(current || 'R-1').match(/R(\d+)/i)
  const currentIndex = match ? Number(match[1]) : -1
  return formatRevisao(currentIndex + 1)
}
