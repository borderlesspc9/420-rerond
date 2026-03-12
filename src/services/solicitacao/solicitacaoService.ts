import type { Solicitacao, SolicitacaoWithFiles } from '../../models/Solicitacao.js'
import { buildApiUrl } from '../api/apiBaseUrl'

// Criar nova solicitação
export const createSolicitacao = async (
  solicitacao: Omit<Solicitacao, 'id' | 'createdAt' | 'updatedAt'>,
  files: File[] = []
): Promise<string> => {
  try {
    const formData = new FormData()
    
    // Adicionar campos do formulário
    formData.append('titulo', solicitacao.titulo)
    formData.append('tipoObra', solicitacao.tipoObra)
    formData.append('localizacao', solicitacao.localizacao)
    formData.append('descricao', solicitacao.descricao)
    if (solicitacao.status) formData.append('status', solicitacao.status)
    if (solicitacao.createdBy) formData.append('createdBy', solicitacao.createdBy)
    // Overview Dados do cliente
    if (solicitacao.cliente) formData.append('cliente', solicitacao.cliente)
    if (solicitacao.kilometragem) formData.append('kilometragem', solicitacao.kilometragem)
    if (solicitacao.nroProcessoErp) formData.append('nroProcessoErp', solicitacao.nroProcessoErp)
    if (solicitacao.rodovia) formData.append('rodovia', solicitacao.rodovia)
    if (solicitacao.nomeConcessionaria) formData.append('nomeConcessionaria', solicitacao.nomeConcessionaria)
    if (solicitacao.sentido) formData.append('sentido', solicitacao.sentido)
    if (solicitacao.ocupacao) formData.append('ocupacao', solicitacao.ocupacao)
    if (solicitacao.municipioEstado) formData.append('municipioEstado', solicitacao.municipioEstado)
    if (solicitacao.ocupacaoArea) formData.append('ocupacaoArea', solicitacao.ocupacaoArea)
    if (solicitacao.responsavelTecnico) formData.append('responsavelTecnico', solicitacao.responsavelTecnico)
    if (solicitacao.faseProjeto) formData.append('faseProjeto', solicitacao.faseProjeto)
    if (solicitacao.analistaResponsavel) formData.append('analistaResponsavel', solicitacao.analistaResponsavel)
    if (solicitacao.memorial) formData.append('memorial', solicitacao.memorial)
    if (solicitacao.dataRecebimento) formData.append('dataRecebimento', solicitacao.dataRecebimento)

    // Adicionar arquivos
    files.forEach((file) => {
      formData.append('files', file)
    })

    const url = buildApiUrl('/solicitacoes')
    console.log('Enviando requisição para:', url)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Não definir Content-Type manualmente - o browser define automaticamente com boundary para FormData
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || `Erro HTTP ${response.status}` }
      }
      throw new Error(errorData.error || `Erro ao criar solicitação (${response.status})`)
    }

    const data = await response.json()
    return data.id
  } catch (error: any) {
    console.error('Erro ao criar solicitação:', error)
    
    // Mensagens de erro mais específicas
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        'Nao foi possivel conectar ao servidor. Verifique a URL da API configurada no deploy.'
      )
    }
    
    throw new Error(error.message || 'Erro ao criar solicitação. Tente novamente.')
  }
}

// Buscar todas as solicitações
export const getAllSolicitacoes = async (): Promise<SolicitacaoWithFiles[]> => {
  try {
    const response = await fetch(buildApiUrl('/solicitacoes'))

    if (!response.ok) {
      throw new Error('Erro ao buscar solicitações')
    }

    const data = await response.json()
    
    // Converter datas de string para Date
    return data.map((s: any) => ({
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
      arquivos: s.arquivos || [],
    }))
  } catch (error) {
    console.error('Erro ao buscar solicitações:', error)
    throw new Error('Erro ao buscar solicitações. Tente novamente.')
  }
}

// Buscar solicitação por ID
export const getSolicitacaoById = async (id: string): Promise<SolicitacaoWithFiles | null> => {
  try {
    const response = await fetch(buildApiUrl(`/solicitacoes/${id}`))

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Erro ao buscar solicitação')
    }

    const data = await response.json()
    
    return {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      arquivos: data.arquivos || [],
    }
  } catch (error) {
    console.error('Erro ao buscar solicitação:', error)
    throw new Error('Erro ao buscar solicitação. Tente novamente.')
  }
}

// Atualizar solicitação
export const updateSolicitacao = async (
  id: string,
  updates: Partial<Solicitacao>
): Promise<SolicitacaoWithFiles> => {
  try {
    const response = await fetch(buildApiUrl(`/solicitacoes/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao atualizar solicitação' }))
      throw new Error(error.error || 'Erro ao atualizar solicitação')
    }

    const data = await response.json()
    
    return {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      analisadoEm: data.analisadoEm ? new Date(data.analisadoEm) : undefined,
      arquivos: data.arquivos || [],
    }
  } catch (error: any) {
    console.error('Erro ao atualizar solicitação:', error)
    throw new Error(error.message || 'Erro ao atualizar solicitação. Tente novamente.')
  }
}

// Deletar solicitação
export const deleteSolicitacao = async (id: string): Promise<void> => {
  try {
    const response = await fetch(buildApiUrl(`/solicitacoes/${id}`), {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao deletar solicitação' }))
      throw new Error(error.error || 'Erro ao deletar solicitação')
    }
  } catch (error: any) {
    console.error('Erro ao deletar solicitação:', error)
    throw new Error(error.message || 'Erro ao deletar solicitação. Tente novamente.')
  }
}

// Analisar solicitação com IA
export const analisarSolicitacaoComIA = async (
  id: string,
  promptCustomizado?: string,
  novosPDFs?: File[]
): Promise<SolicitacaoWithFiles> => {
  try {
    const formData = new FormData()
    
    // Adicionar prompt customizado se fornecido
    if (promptCustomizado) {
      formData.append('promptCustomizado', promptCustomizado)
    }
    
    // Adicionar novos PDFs se fornecidos
    if (novosPDFs && novosPDFs.length > 0) {
      novosPDFs.forEach((file) => {
        formData.append('novosPDFs', file)
      })
    }

    const response = await fetch(buildApiUrl(`/solicitacoes/${id}/analisar`), {
      method: 'POST',
      body: formData,
      // Não definir Content-Type - o browser define automaticamente com boundary para FormData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro ao analisar solicitação' }))
      const msg = errorData.message || errorData.error || 'Erro ao analisar solicitação'
      throw new Error(msg)
    }

    const data = await response.json()
    
    return {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      analisadoEm: data.analisadoEm ? new Date(data.analisadoEm) : undefined,
      arquivos: data.arquivos || [],
    }
  } catch (error: any) {
    console.error('Erro ao analisar solicitação:', error)
    throw new Error(error.message || 'Erro ao analisar solicitação. Tente novamente.')
  }
}
