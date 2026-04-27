/** Chave alinhada ao que o apiClient usa para Bearer (quando houver API real). */
export const AUTH_TOKEN_KEY = 'auth_token'

export function getSessionToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setSessionToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getSessionToken()?.trim())
}
