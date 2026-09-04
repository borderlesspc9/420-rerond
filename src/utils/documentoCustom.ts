export type DocumentoCustomDraft = {
  label: string
  descricao: string
}

export const EMPTY_DOCUMENTO_DRAFT: DocumentoCustomDraft = {
  label: '',
  descricao: '',
}

export type DocumentoCustomFieldErrors = {
  label?: string
}

export function slugifyDocumentoId(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base ? `custom_${base}` : `custom_${Date.now()}`
}

export function validateDocumentoCustomDraft(
  draft: DocumentoCustomDraft,
): DocumentoCustomFieldErrors {
  const errors: DocumentoCustomFieldErrors = {}
  if (!draft.label.trim()) {
    errors.label = 'Informe o nome do documento (obrigatório).'
  }
  return errors
}

export function buildDocumentoCustomFromDraft(
  draft: DocumentoCustomDraft,
  existingIds: string[],
): { id: string; label: string; descricao?: string } {
  let id = slugifyDocumentoId(draft.label)
  if (existingIds.includes(id)) {
    id = `${id}_${Date.now().toString(36)}`
  }
  const descricao = draft.descricao.trim()
  return {
    id,
    label: draft.label.trim(),
    ...(descricao ? { descricao } : {}),
  }
}
