import {
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../../lib/firebase'

export interface LoginCredentials {
  email: string
  password: string
}

export const login = async (
  email: string,
  password: string,
): Promise<User> => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export const logout = async (): Promise<void> => {
  await signOut(auth)
}
