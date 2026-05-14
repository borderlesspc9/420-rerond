import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
] as const satisfies ReadonlyArray<keyof typeof firebaseConfig>

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]?.trim())

if (missingKeys.length > 0) {
  throw new Error(
    'Configuração Firebase incompleta. Defina VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID no .env.',
  )
}

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp, 'southamerica-east1')

let analyticsInstance: Analytics | null = null
let analyticsInitPromise: Promise<Analytics | null> | null = null

export const initFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (analyticsInstance) {
    return analyticsInstance
  }

  const measurementId = firebaseConfig.measurementId?.trim()
  const analyticsEnabled =
    import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS === 'true' ||
    (import.meta.env.PROD && import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS !== 'false')

  if (!measurementId || !analyticsEnabled) {
    return null
  }

  if (!analyticsInitPromise) {
    analyticsInitPromise = isSupported()
      .then((supported) => {
        if (!supported) {
          return null
        }

        analyticsInstance = getAnalytics(firebaseApp)
        return analyticsInstance
      })
      .catch(() => null)
  }

  return analyticsInitPromise
}
