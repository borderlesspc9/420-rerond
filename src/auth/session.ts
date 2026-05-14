import { auth } from '../lib/firebase'

export async function getSessionToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) {
    return null
  }

  return user.getIdToken()
}

export function isAuthenticated(): boolean {
  return Boolean(auth.currentUser)
}
