import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  TIPOS_ANALISE_SEED,
  type TipoAnalise,
  type TipoAnaliseDraft,
} from '../../models/TipoAnalise'

const COLLECTION =
  import.meta.env.VITE_FIRESTORE_TIPOS_ANALISE_COLLECTION?.trim() || 'tiposAnalise'

const MOCK_KEY = 'rerond-tipos-analise-mock-v3'

let mockMode = false

export function isTiposAnaliseMockMode(): boolean {
  return mockMode
}

const isPermissionError = (err: unknown) => {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  return (
    code.includes('permission-denied') ||
    message.toLowerCase().includes('insufficient permissions') ||
    message.toLowerCase().includes('missing or insufficient permissions')
  )
}

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  return undefined
}

const enrichFromSeed = (tipo: TipoAnalise): TipoAnalise => {
  const seed = TIPOS_ANALISE_SEED.find((item) => item.id === tipo.id)
  if (!seed) return tipo
  return {
    ...tipo,
    requisitos: tipo.requisitos?.length ? tipo.requisitos : seed.requisitos,
    normasFontes: tipo.normasFontes?.length ? tipo.normasFontes : seed.normasFontes,
    promptOrientacao: tipo.promptOrientacao || seed.promptOrientacao,
    documentosSugeridos: tipo.documentosSugeridos?.length
      ? tipo.documentosSugeridos
      : seed.documentosSugeridos,
  }
}

const parseTipo = (id: string, raw: Record<string, unknown>): TipoAnalise =>
  enrichFromSeed({
    id,
    nome: String(raw.nome ?? ''),
    slug: String(raw.slug ?? id),
    categoria: (raw.categoria as TipoAnalise['categoria']) || 'outro',
    descricao: String(raw.descricao ?? ''),
    finalidade: raw.finalidade ? String(raw.finalidade) : undefined,
    normasFontes: Array.isArray(raw.normasFontes) ? raw.normasFontes.map(String) : [],
    documentosSugeridos: Array.isArray(raw.documentosSugeridos)
      ? raw.documentosSugeridos.map(String)
      : [],
    requisitos: Array.isArray(raw.requisitos)
      ? (raw.requisitos as TipoAnalise['requisitos'])
      : [],
    promptOrientacao: raw.promptOrientacao ? String(raw.promptOrientacao) : undefined,
    ativo: raw.ativo !== false,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  })

const readMock = (): TipoAnalise[] => {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (!raw) return TIPOS_ANALISE_SEED.map((item) => ({ ...item }))
    const parsed = JSON.parse(raw) as TipoAnalise[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return TIPOS_ANALISE_SEED.map((item) => ({ ...item }))
    }
    return parsed.map(enrichFromSeed)
  } catch {
    return TIPOS_ANALISE_SEED.map((item) => ({ ...item }))
  }
}

const writeMock = (items: TipoAnalise[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items))
}

const slugify = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

export async function listTiposAnalise(): Promise<TipoAnalise[]> {
  if (mockMode) {
    return readMock().filter((item) => item.ativo)
  }
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('nome')))
    if (snap.empty) {
      // Seed remoto silencioso quando coleção vazia e com permissão
      for (const seed of TIPOS_ANALISE_SEED) {
        await setDoc(doc(db, COLLECTION, seed.id), {
          ...seed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      const again = await getDocs(query(collection(db, COLLECTION), orderBy('nome')))
      return again.docs
        .map((item) => parseTipo(item.id, item.data() as Record<string, unknown>))
        .filter((item) => item.ativo)
    }
    return snap.docs
      .map((item) => parseTipo(item.id, item.data() as Record<string, unknown>))
      .filter((item) => item.ativo)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return readMock().filter((item) => item.ativo)
    }
    throw err
  }
}

export async function getTipoAnaliseById(id: string): Promise<TipoAnalise | null> {
  const list = await listTiposAnalise()
  return list.find((item) => item.id === id) ?? null
}

export async function saveTipoAnalise(draft: TipoAnaliseDraft): Promise<TipoAnalise> {
  const nome = draft.nome.trim()
  if (!nome) throw new Error('Informe o nome do tipo de análise.')
  const slug = (draft.slug || slugify(nome)).trim() || slugify(nome)
  const id = draft.id?.trim() || slug

  const payload = {
    nome,
    slug,
    categoria: draft.categoria || 'outro',
    descricao: draft.descricao.trim(),
    finalidade: draft.finalidade?.trim() || null,
    normasFontes: draft.normasFontes ?? [],
    documentosSugeridos: draft.documentosSugeridos ?? [],
    requisitos: draft.requisitos ?? [],
    promptOrientacao: draft.promptOrientacao?.trim() || null,
    ativo: draft.ativo !== false,
    updatedAt: new Date().toISOString(),
  }

  if (mockMode) {
    const items = readMock()
    const existing = items.findIndex((item) => item.id === id)
    const next: TipoAnalise = {
      id,
      ...payload,
      finalidade: payload.finalidade || undefined,
      promptOrientacao: payload.promptOrientacao || undefined,
      createdAt: existing >= 0 ? items[existing].createdAt : new Date(),
      updatedAt: new Date(),
    }
    if (existing >= 0) items[existing] = next
    else items.push(next)
    writeMock(items)
    return next
  }

  try {
    const ref = doc(db, COLLECTION, id)
    const snap = await getDoc(ref)
    await setDoc(
      ref,
      {
        ...payload,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    )
    const saved = await getDoc(ref)
    return parseTipo(saved.id, saved.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return saveTipoAnalise(draft)
    }
    throw err
  }
}

export async function updateTipoAnalise(
  id: string,
  patch: Partial<TipoAnaliseDraft>,
): Promise<TipoAnalise> {
  if (mockMode) {
    const items = readMock()
    const idx = items.findIndex((item) => item.id === id)
    if (idx < 0) throw new Error('Tipo de análise não encontrado.')
    const next = {
      ...items[idx],
      ...patch,
      id,
      updatedAt: new Date(),
    } as TipoAnalise
    items[idx] = next
    writeMock(items)
    return next
  }
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    const saved = await getDoc(doc(db, COLLECTION, id))
    if (!saved.exists()) throw new Error('Tipo de análise não encontrado.')
    return parseTipo(saved.id, saved.data() as Record<string, unknown>)
  } catch (err) {
    if (isPermissionError(err)) {
      mockMode = true
      return updateTipoAnalise(id, patch)
    }
    throw err
  }
}

/** Utilitário para formulários — cria tipo "Outro" ad-hoc com descrição. */
export async function ensureTipoOutroComDescricao(descricao: string): Promise<TipoAnalise> {
  const base = await getTipoAnaliseById('outro')
  if (!descricao.trim()) {
    if (base) return base
    return saveTipoAnalise({
      id: 'outro',
      nome: 'Outro',
      slug: 'outro',
      categoria: 'outro',
      descricao: 'Tipo extensível',
      normasFontes: [],
      documentosSugeridos: [],
      requisitos: [],
    })
  }
  return saveTipoAnalise({
    nome: descricao.trim().slice(0, 80),
    slug: slugify(descricao),
    categoria: 'outro',
    descricao: descricao.trim(),
    normasFontes: base?.normasFontes ?? [],
    documentosSugeridos: [],
    requisitos: [],
    promptOrientacao: base?.promptOrientacao,
  })
}
