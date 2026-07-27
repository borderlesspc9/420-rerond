/**
 * Seed / upsert de concessionárias no Firestore.
 *
 * Uso:
 *   npm run seed:concessionarias
 *
 * Requer firebase-service-account.json (ou GOOGLE_APPLICATION_CREDENTIALS).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
  override: true,
})

const COLLECTION =
  process.env.FIRESTORE_CONCESSIONARIAS_COLLECTION?.trim() || 'concessionarias'

type SeedConcessionaria = {
  id: string
  nome: string
  promptProfile: 'eco101' | 'motiva' | 'arteris' | 'default'
  logoPath: string
  logoFile: string
  aliases: string[]
  ativo: boolean
}

const SEEDS: SeedConcessionaria[] = [
  {
    id: 'eco101',
    nome: 'Ecovias / ECO101',
    promptProfile: 'eco101',
    logoPath: '/logo-ecovias.png',
    logoFile: 'logo-ecovias.png',
    aliases: ['ecovias', 'eco101', 'eco 101'],
    ativo: true,
  },
  {
    id: 'motiva',
    nome: 'Motiva',
    promptProfile: 'motiva',
    logoPath: '/logo-motiva.png',
    logoFile: 'logo-motiva.png',
    aliases: ['motiva', 'ccr', 'grupo ccr'],
    ativo: true,
  },
  {
    id: 'arteris',
    nome: 'Arteris',
    promptProfile: 'arteris',
    logoPath: '/logo-arteris.png',
    logoFile: 'logo-arteris.png',
    aliases: ['arteris'],
    ativo: true,
  },
]

const log = {
  info: (msg: string, extra?: Record<string, unknown>) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
    console.log(`[seed:concessionarias] ${msg}${suffix}`)
  },
  warn: (msg: string, extra?: Record<string, unknown>) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
    console.warn(`[seed:concessionarias] WARN ${msg}${suffix}`)
  },
  error: (msg: string, extra?: Record<string, unknown>) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
    console.error(`[seed:concessionarias] ERROR ${msg}${suffix}`)
  },
  ok: (msg: string, extra?: Record<string, unknown>) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
    console.log(`[seed:concessionarias] ✓ ${msg}${suffix}`)
  },
}

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
    log.info('Firebase Admin já inicializado')
    return
  }

  const serviceAccountPath = resolveServiceAccountPath()
  log.info('Carregando service account', { path: serviceAccountPath })

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Service account não encontrado em ${serviceAccountPath}. ` +
        'Defina GOOGLE_APPLICATION_CREDENTIALS ou coloque firebase-service-account.json na raiz.',
    )
  }

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

  log.ok('Firebase Admin inicializado', {
    projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id,
  })
}

const assertLogoExists = (seed: SeedConcessionaria) => {
  const absolute = path.resolve(process.cwd(), 'public', seed.logoFile)
  if (!existsSync(absolute)) {
    log.warn('Logo ausente em public/', { id: seed.id, expected: absolute })
    return { ok: false as const, absolute, bytes: 0 }
  }
  const bytes = statSync(absolute).size
  log.ok('Logo encontrada', { id: seed.id, file: seed.logoFile, bytes })
  return { ok: true as const, absolute, bytes }
}

const upsertConcessionaria = async (seed: SeedConcessionaria) => {
  const db = getFirestore()
  const ref = db.collection(COLLECTION).doc(seed.id)
  const snap = await ref.get()
  const logo = assertLogoExists(seed)

  const payload = {
    id: seed.id,
    nome: seed.nome,
    promptProfile: seed.promptProfile,
    logoPath: seed.logoPath,
    logoFile: seed.logoFile,
    logoPresenteEmPublic: logo.ok,
    logoBytes: logo.bytes,
    aliases: seed.aliases,
    ativo: seed.ativo,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (snap.exists) {
    await ref.set(payload, { merge: true })
    log.ok('Atualizada no Firestore', { collection: COLLECTION, id: seed.id, nome: seed.nome })
    return { id: seed.id, action: 'updated' as const, logoOk: logo.ok }
  }

  await ref.set({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  })
  log.ok('Criada no Firestore', { collection: COLLECTION, id: seed.id, nome: seed.nome })
  return { id: seed.id, action: 'created' as const, logoOk: logo.ok }
}

async function main() {
  log.info('Iniciando seed de concessionárias', {
    collection: COLLECTION,
    total: SEEDS.length,
    ids: SEEDS.map((s) => s.id),
  })

  initAdmin()

  const results: Array<{ id: string; action: 'created' | 'updated'; logoOk: boolean }> = []

  for (const seed of SEEDS) {
    log.info('Processando', { id: seed.id, nome: seed.nome })
    const result = await upsertConcessionaria(seed)
    results.push(result)
  }

  const created = results.filter((r) => r.action === 'created').length
  const updated = results.filter((r) => r.action === 'updated').length
  const logosOk = results.filter((r) => r.logoOk).length
  const logosMissing = results.filter((r) => !r.logoOk).length

  log.info('——— Resumo ———')
  log.ok(`Criadas: ${created}`)
  log.ok(`Atualizadas: ${updated}`)
  log.ok(`Logos OK em public/: ${logosOk}/${results.length}`)
  if (logosMissing > 0) {
    log.warn(`Logos ausentes: ${logosMissing}`)
  }
  log.info('Seed finalizado')
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
