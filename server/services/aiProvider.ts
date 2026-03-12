/**
 * Provider de IA - Suporta OpenAI e Groq
 * Prioridade: OpenAI se OPENAI_API_KEY configurado, senão Groq como fallback
 */

export type AIProvider = 'groq' | 'openai'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
}

/**
 * Detecta qual provider usar baseado nas variáveis de ambiente
 * Prioridade: OpenAI > Groq
 */
export function detectAIProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY) {
    return 'openai'
  }

  if (process.env.GROQ_API_KEY) {
    console.warn(`⚠️  OPENAI_API_KEY não encontrada. Usando Groq como fallback (sem suporte a visão em PDFs).`)
    return 'groq'
  }

  throw new Error(
    'Nenhuma chave de API configurada. Configure OPENAI_API_KEY ou GROQ_API_KEY no arquivo .env'
  )
}

/**
 * Obtém configuração do provider atual
 */
export function getAIConfig(): AIConfig {
  const provider = detectAIProvider()

  if (provider === 'groq') {
    return {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY!,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    }
  }

  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  }
}

/**
 * Interface comum para respostas de chat
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletion {
  content: string
  model?: string
  provider: AIProvider
}
