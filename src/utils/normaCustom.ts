import type { NormaCustom } from '../models/ConcessionariaPerfil'

export const NORMA_ARQUIVO_MAX_BYTES = 15 * 1024 * 1024
export const NORMA_ARQUIVO_TIPOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const

export type NormaCustomDraft = {
  titulo: string
  orgao: string
  ano: string
  descricao: string
  arquivo: File | null
  arquivoNome: string | null
}

export const EMPTY_NORMA_DRAFT: NormaCustomDraft = {
  titulo: '',
  orgao: '',
  ano: '',
  descricao: '',
  arquivo: null,
  arquivoNome: null,
}

export type NormaCustomFieldErrors = {
  titulo?: string
  orgao?: string
  descricao?: string
  ano?: string
  arquivo?: string
}

export function slugifyNormaId(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base ? `CUSTOM_${base}` : `CUSTOM_${Date.now()}`
}

export function tituloHintFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateNormaArquivo(file: File): string | null {
  if (file.size <= 0) {
    return 'Arquivo vazio. Selecione outro arquivo ou preencha a norma manualmente.'
  }
  if (file.size > NORMA_ARQUIVO_MAX_BYTES) {
    return 'Arquivo muito grande (máx. 15 MB). Reduza o arquivo ou cadastre só os dados manuais.'
  }
  const byType = NORMA_ARQUIVO_TIPOS.includes(
    file.type as (typeof NORMA_ARQUIVO_TIPOS)[number],
  )
  const byExt = /\.(pdf|doc|docx|txt)$/i.test(file.name)
  if (!byType && !byExt) {
    return 'Formato não suportado. Use PDF, DOC, DOCX ou TXT.'
  }
  return null
}

/** Valida campos obrigatórios — arquivo sozinho nunca conclui o cadastro. */
export function validateNormaCustomDraft(
  draft: NormaCustomDraft,
): NormaCustomFieldErrors {
  const errors: NormaCustomFieldErrors = {}
  if (!draft.titulo.trim()) {
    errors.titulo = 'Informe o título da norma (obrigatório).'
  }
  if (!draft.orgao.trim()) {
    errors.orgao = 'Informe o órgão emissor (obrigatório).'
  }
  if (!draft.descricao.trim()) {
    errors.descricao =
      'Informe a descrição / o que a IA deve considerar (obrigatório).'
  }
  if (draft.ano.trim()) {
    const year = Number(draft.ano)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      errors.ano = 'Ano inválido. Use um número entre 1900 e 2100 ou deixe em branco.'
    }
  }
  if (draft.arquivo) {
    const fileError = validateNormaArquivo(draft.arquivo)
    if (fileError) errors.arquivo = fileError
  }
  return errors
}

export function buildNormaCustomFromDraft(
  draft: NormaCustomDraft,
  existingIds: string[],
): NormaCustom {
  let id = slugifyNormaId(draft.titulo)
  if (existingIds.includes(id)) {
    id = `${id}_${Date.now().toString(36).toUpperCase()}`
  }
  const ano = draft.ano.trim() ? Number(draft.ano) : null
  return {
    id,
    titulo: draft.titulo.trim(),
    orgao: draft.orgao.trim(),
    ano: Number.isFinite(ano) ? ano : null,
    descricao: draft.descricao.trim(),
    arquivoNome: draft.arquivoNome || draft.arquivo?.name || null,
    arquivoUrl: null,
    arquivoStoragePath: null,
    origem: draft.arquivo ? 'arquivo' : 'manual',
  }
}
