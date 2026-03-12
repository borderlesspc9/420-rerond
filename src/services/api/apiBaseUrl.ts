const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = configuredApiBaseUrl
  ? normalizeBaseUrl(configuredApiBaseUrl)
  : typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : '/api'

export const buildApiUrl = (endpoint: string) => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${normalizedEndpoint}`
}