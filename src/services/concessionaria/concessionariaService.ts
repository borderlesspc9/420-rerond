import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { ConcessionariaPerfil, ConcessionariaPerfilDraft } from '../../models/ConcessionariaPerfil'
import { slugifyConcessionariaNome } from '../../config/modelosRelatorioPadrao'

const COLLECTION_NAME =
  import.meta.env.VITE_FIRESTORE_CONCESSIONARIAS_COLLECTION?.trim() || 'concessionarias'

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  return undefined
}

const parsePerfil = (id: string, raw: Record<string, unknown>): ConcessionariaPerfil => ({
  id,
  nome: String(raw.nome ?? ''),
  aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
  ativo: raw.ativo !== false,
  promptProfile:
    raw.promptProfile === 'eco101' ||
    raw.promptProfile === 'motiva' ||
    raw.promptProfile === 'arteris' ||
    raw.promptProfile === 'custom'
      ? raw.promptProfile
      : 'default',
  templateId: raw.templateId ? String(raw.templateId) : null,
  rodovia: raw.rodovia ? String(raw.rodovia) : undefined,
  tipoProjetoPadrao:
    raw.tipoProjetoPadrao === 'obra_per' || raw.tipoProjetoPadrao === 'obra_nao_per'
      ? raw.tipoProjetoPadrao
      : 'pit',
  normasFontes: Array.isArray(raw.normasFontes) ? raw.normasFontes.map(String) : [],
  modeloRelatorio: {
    tituloPadrao: String(
      (raw.modeloRelatorio as Record<string, unknown> | undefined)?.tituloPadrao ??
        'Parecer Técnico',
    ),
    descricao: (raw.modeloRelatorio as Record<string, unknown> | undefined)?.descricao
      ? String((raw.modeloRelatorio as Record<string, unknown>).descricao)
      : undefined,
    templateMarkdown: String(
      (raw.modeloRelatorio as Record<string, unknown> | undefined)?.templateMarkdown ?? '',
    ),
  },
  documentosObrigatorios: Array.isArray(raw.documentosObrigatorios)
    ? (raw.documentosObrigatorios as ConcessionariaPerfil['documentosObrigatorios'])
    : [],
  requisitos: Array.isArray(raw.requisitos)
    ? (raw.requisitos as ConcessionariaPerfil['requisitos'])
    : [],
  logoUrl: raw.logoUrl ? String(raw.logoUrl) : null,
  logoDataUrl: raw.logoDataUrl ? String(raw.logoDataUrl) : null,
  perfilCompleto: raw.perfilCompleto === true,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
})

export async function listConcessionariasPerfil(): Promise<ConcessionariaPerfil[]> {
  const ref = collection(db, COLLECTION_NAME)
  const snap = await getDocs(query(ref, orderBy('nome')))
  return snap.docs
    .map((item) => parsePerfil(item.id, item.data() as Record<string, unknown>))
    .filter((item) => item.ativo)
}

export async function getConcessionariaPerfilById(
  id: string,
): Promise<ConcessionariaPerfil | null> {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id))
  if (!snap.exists()) return null
  return parsePerfil(snap.id, snap.data() as Record<string, unknown>)
}

export async function saveConcessionariaPerfil(
  draft: ConcessionariaPerfilDraft,
  options?: { id?: string; perfilCompleto?: boolean },
): Promise<ConcessionariaPerfil> {
  const id = options?.id?.trim() || slugifyConcessionariaNome(draft.nome)
  if (!id) {
    throw new Error('Informe o nome da concessionária para gerar o identificador.')
  }

  const existing = await getDoc(doc(db, COLLECTION_NAME, id))
  const payload = {
    id,
    nome: draft.nome.trim(),
    aliases: draft.aliases.map((item) => item.trim()).filter(Boolean),
    ativo: true,
    promptProfile: draft.promptProfile,
    templateId: draft.templateId ?? null,
    rodovia: draft.rodovia?.trim() || null,
    tipoProjetoPadrao: draft.tipoProjetoPadrao,
    normasFontes: draft.normasFontes,
    modeloRelatorio: draft.modeloRelatorio,
    documentosObrigatorios: draft.documentosObrigatorios,
    requisitos: draft.requisitos,
    logoUrl: draft.logoUrl ?? null,
    logoDataUrl: draft.logoDataUrl ?? null,
    perfilCompleto: options?.perfilCompleto ?? true,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  }

  await setDoc(doc(db, COLLECTION_NAME, id), payload, { merge: true })
  const saved = await getConcessionariaPerfilById(id)
  if (!saved) {
    throw new Error('Não foi possível carregar a concessionária após salvar.')
  }
  return saved
}

export async function updateConcessionariaPerfilFields(
  id: string,
  patch: Partial<
    Pick<
      ConcessionariaPerfil,
      'nome' | 'rodovia' | 'tipoProjetoPadrao' | 'aliases' | 'modeloRelatorio'
    >
  >,
): Promise<ConcessionariaPerfil> {
  const ref = doc(db, COLLECTION_NAME, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new Error('Concessionária não encontrada.')
  }

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (patch.nome !== undefined) payload.nome = patch.nome.trim()
  if (patch.rodovia !== undefined) payload.rodovia = patch.rodovia.trim() || null
  if (patch.tipoProjetoPadrao !== undefined) payload.tipoProjetoPadrao = patch.tipoProjetoPadrao
  if (patch.aliases !== undefined) payload.aliases = patch.aliases
  if (patch.modeloRelatorio !== undefined) {
    const current = snap.data().modeloRelatorio as Record<string, unknown> | undefined
    payload.modeloRelatorio = {
      ...current,
      ...patch.modeloRelatorio,
    }
  }

  await setDoc(ref, payload, { merge: true })
  const updated = await getConcessionariaPerfilById(id)
  if (!updated) {
    throw new Error('Não foi possível carregar a concessionária após atualizar.')
  }
  return updated
}
