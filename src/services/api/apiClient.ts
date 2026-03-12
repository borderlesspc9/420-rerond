import { API_BASE_URL } from './apiBaseUrl'

// Interface para opções de requisição
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
}

// Cliente HTTP para fazer requisições à API
class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<{ data: T }> {
    const { method = 'GET', headers = {}, body } = options

    const url = `${this.baseURL}${endpoint}`

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    // Adicionar token de autenticação se existir
    const token = this.getToken()
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }

    if (body) {
      config.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw {
          response: {
            data: errorData,
            status: response.status,
          },
          request: null,
        }
      }

      const data = await response.json()
      return { data }
    } catch (error: any) {
      if (error.response) {
        throw error
      }
      // Erro de rede
      throw {
        request: error,
        response: null,
      }
    }
  }

  private getToken(): string | null {
    // Você pode implementar a lógica de obter o token do storage aqui
    // Exemplo: return localStorage.getItem('token')
    return null
  }

  get<T>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', headers })
  }

  post<T>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'POST', body, headers })
  }

  put<T>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PUT', body, headers })
  }

  patch<T>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers })
  }

  delete<T>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'DELETE', headers })
  }
}

// Instância do cliente API
export const apiClient = new ApiClient(API_BASE_URL)
