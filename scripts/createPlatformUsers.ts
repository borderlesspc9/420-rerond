import { readFileSync } from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
  override: true,
})

type SeedUser = {
  email: string
  password: string
  displayName: string
}

const defaultUsers: SeedUser[] = [
  {
    email: 'borderlessrerond@gmail.com',
    password: 'Borderless02$$',
    displayName: 'Administrador Borderless',
  },
  {
    email: 'analista@rerond.app',
    password: 'RerondAnalista2026!',
    displayName: 'Analista Rerond',
  },
  {
    email: 'portal@rerond.app',
    password: 'RerondPortal2026!',
    displayName: 'Portal Rerond',
  },
]

const resolveServiceAccountPath = () => {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!configured) {
    return path.resolve(process.cwd(), 'firebase-service-account.json')
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured)
}

const initAdmin = () => {
  if (getApps().length > 0) {
    return
  }

  const serviceAccountPath = resolveServiceAccountPath()
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as {
    project_id: string
    client_email: string
    private_key: string
  }

  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id,
  })
}

const upsertUser = async (user: SeedUser) => {
  const auth = getAuth()
  const existing = await auth.getUserByEmail(user.email).catch(() => null)

  if (existing) {
    await auth.updateUser(existing.uid, {
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    })
    return { email: user.email, action: 'updated' as const }
  }

  await auth.createUser({
    email: user.email,
    password: user.password,
    displayName: user.displayName,
    emailVerified: true,
  })

  return { email: user.email, action: 'created' as const }
}

const main = async () => {
  initAdmin()

  const results = []
  for (const user of defaultUsers) {
    results.push(await upsertUser(user))
  }

  console.log('Usuários da plataforma prontos:')
  for (const result of results) {
    console.log(`- ${result.email} (${result.action})`)
  }
}

main().catch((error) => {
  console.error('Falha ao criar usuários da plataforma:', error)
  process.exit(1)
})
