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
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import type {
  ConcessionariaPerfil,
  ConcessionariaPerfilDraft,
  NormaCustom,
} from '../../models/ConcessionariaPerfil'
import { slugifyConcessionariaNome } from '../../config/modelosRelatorioPadrao'
import { validateNormaArquivo } from '../../utils/normaCustom'

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

const parseNormaCustom = (raw: unknown): NormaCustom | null => {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = String(item.id ?? '').trim()
  const titulo = String(item.titulo ?? '').trim()
  const orgao = String(item.orgao ?? '').trim()
  const descricao = String(item.descricao ?? '').trim()
  if (!id || !titulo || !orgao || !descricao) return null

  const anoRaw = item.ano
  const ano =
    typeof anoRaw === 'number' && Number.isFinite(anoRaw)
      ? anoRaw
      : typeof anoRaw === 'string' && anoRaw.trim()
        ? Number(anoRaw)
        : null

  return {
    id,
    titulo,
    orgao,
    ano: ano !== null && Number.isFinite(ano) ? ano : null,
    descricao,
    arquivoNome: item.arquivoNome ? String(item.arquivoNome) : null,
    arquivoUrl: item.arquivoUrl ? String(item.arquivoUrl) : null,
    arquivoStoragePath: item.arquivoStoragePath
      ? String(item.arquivoStoragePath)
      : null,
    origem: item.origem === 'arquivo' ? 'arquivo' : 'manual',
  }
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
  normasCustom: Array.isArray(raw.normasCustom)
    ? raw.normasCustom
        .map(parseNormaCustom)
        .filter((item): item is NormaCustom => item !== null)
    : [],
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
    ? raw.documentosObrigatorios.map(String)
    : [],
  documentosCustom: Array.isArray(raw.documentosCustom)
    ? raw.documentosCustom
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const id = String(row.id ?? '').trim()
          const label = String(row.label ?? '').trim()
          if (!id || !label) return null
          const descricao = row.descricao ? String(row.descricao).trim() : ''
          return {
            id,
            label,
            ...(descricao ? { descricao } : {}),
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
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
  const colRef = collection(db, COLLECTION_NAME)
  const snap = await getDocs(query(colRef, orderBy('nome')))
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

/** Upload opcional de PDF/DOC de norma. Falha de storage NÃO interrompe o cadastro. */
export async function uploadNormaArquivoSafe(
  file: File,
  concessionariaId: string,
  normaId: string,
): Promise<{ url: string | null; storagePath: string | null; warning?: string }> {
  const validationError = validateNormaArquivo(file)
  if (validationError) {
    return { url: null, storagePath: null, warning: validationError }
  }

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const storagePath = `concessionarias/${concessionariaId}/normas/${normaId}_${safeName}`
    const fileRef = storageRef(storage, storagePath)
    await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        normaId,
        originalName: file.name.slice(0, 120),
      },
    })
    const url = await getDownloadURL(fileRef)
    return { url, storagePath }
  } catch (err) {
    console.warn('Upload de norma falhou (perfil segue sem arquivo):', err)
    return {
      url: null,
      storagePath: null,
      warning:
        'Não foi possível enviar o arquivo da norma. Os dados textuais foram salvos; anexe o arquivo depois se necessário.',
    }
  }
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
  const normasCustom = (draft.normasCustom ?? []).map((item) => ({
    id: item.id,
    titulo: item.titulo.trim(),
    orgao: item.orgao.trim(),
    ano: item.ano ?? null,
    descricao: item.descricao.trim(),
    arquivoNome: item.arquivoNome ?? null,
    arquivoUrl: item.arquivoUrl ?? null,
    arquivoStoragePath: item.arquivoStoragePath ?? null,
    origem: item.origem === 'arquivo' ? 'arquivo' : 'manual',
  }))

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
    normasCustom,
    modeloRelatorio: draft.modeloRelatorio,
    documentosObrigatorios: draft.documentosObrigatorios,
    documentosCustom: (draft.documentosCustom ?? []).map((item) => ({
      id: item.id,
      label: item.label.trim(),
      ...(item.descricao?.trim() ? { descricao: item.descricao.trim() } : {}),
    })),
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
  const docRef = doc(db, COLLECTION_NAME, id)
  const snap = await getDoc(docRef)
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

  await setDoc(docRef, payload, { merge: true })
  const updated = await getConcessionariaPerfilById(id)
  if (!updated) {
    throw new Error('Não foi possível carregar a concessionária após atualizar.')
  }
  return updated
}
