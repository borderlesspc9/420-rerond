export type Cliente = {
  id: string
  razaoSocial: string
  nomeFantasia?: string | null
  cnpj?: string | null
  email?: string | null
  telefone?: string | null
  contatoNome?: string | null
  observacoes?: string | null
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type ClienteDraft = {
  razaoSocial: string
  nomeFantasia?: string
  cnpj?: string
  email?: string
  telefone?: string
  contatoNome?: string
  observacoes?: string
  ativo?: boolean
}

export function getClienteDisplayName(cliente: Pick<Cliente, 'razaoSocial' | 'nomeFantasia'>): string {
  const fantasia = cliente.nomeFantasia?.trim()
  if (fantasia) return fantasia
  return cliente.razaoSocial.trim()
}
