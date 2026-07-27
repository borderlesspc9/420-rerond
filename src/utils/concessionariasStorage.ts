export const CONCESSIONARIAS_STORAGE_KEY = 'nova-solicitacao:concessionarias'

export type ConcessionariaCadastrada = {
  nome: string
  logoDataUrl?: string | null
  logoUrl?: string | null
}

function normalizeNome(nome: string) {
  return nome.trim()
}

function parseItem(raw: unknown): ConcessionariaCadastrada | null {
  if (typeof raw === 'string') {
    const nome = normalizeNome(raw)
    return nome ? { nome, logoDataUrl: null, logoUrl: null } : null
  }

  if (!raw || typeof raw !== 'object') return null

  const item = raw as Record<string, unknown>
  const nome = normalizeNome(String(item.nome ?? ''))
  if (!nome) return null

  return {
    nome,
    logoDataUrl: item.logoDataUrl ? String(item.logoDataUrl) : null,
    logoUrl: item.logoUrl ? String(item.logoUrl) : null,
  }
}

export const loadConcessionarias = (): ConcessionariaCadastrada[] => {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(CONCESSIONARIAS_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(parseItem)
      .filter((item): item is ConcessionariaCadastrada => item != null)
  } catch (error) {
    console.error('Erro ao carregar concessionárias do localStorage:', error)
    return []
  }
}

export const saveConcessionarias = (concessionarias: ConcessionariaCadastrada[]): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONCESSIONARIAS_STORAGE_KEY, JSON.stringify(concessionarias))
}

export const findConcessionariaCadastrada = (
  nome?: string | null,
): ConcessionariaCadastrada | null => {
  const normalized = normalizeNome(nome || '')
  if (!normalized) return null

  return (
    loadConcessionarias().find(
      (item) => item.nome.toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  )
}

export const getLogoConcessionariaCadastrada = (
  nome?: string | null,
): { dataUrl?: string | null; url?: string | null } | null => {
  const found = findConcessionariaCadastrada(nome)
  if (!found) return null
  if (!found.logoDataUrl && !found.logoUrl) return null
  return { dataUrl: found.logoDataUrl, url: found.logoUrl }
}

export const addConcessionaria = (
  concessionarias: ConcessionariaCadastrada[],
  nome: string,
  logo?: { dataUrl?: string | null; url?: string | null } | null,
): {
  concessionarias: ConcessionariaCadastrada[]
  added: boolean
  updated: boolean
  nome: string
} => {
  const normalized = normalizeNome(nome)
  if (!normalized) {
    return { concessionarias, added: false, updated: false, nome: normalized }
  }

  const index = concessionarias.findIndex(
    (item) => item.nome.toLowerCase() === normalized.toLowerCase(),
  )

  if (index >= 0) {
    const atual = concessionarias[index]
    const nextLogoDataUrl = logo?.dataUrl ?? atual.logoDataUrl ?? null
    const nextLogoUrl = logo?.url ?? atual.logoUrl ?? null
    const logoChanged =
      nextLogoDataUrl !== (atual.logoDataUrl ?? null) ||
      nextLogoUrl !== (atual.logoUrl ?? null)

    if (!logoChanged) {
      return { concessionarias, added: false, updated: false, nome: atual.nome }
    }

    const updatedList = concessionarias.map((item, i) =>
      i === index
        ? { ...item, logoDataUrl: nextLogoDataUrl, logoUrl: nextLogoUrl }
        : item,
    )
    saveConcessionarias(updatedList)
    return { concessionarias: updatedList, added: false, updated: true, nome: atual.nome }
  }

  const created: ConcessionariaCadastrada = {
    nome: normalized,
    logoDataUrl: logo?.dataUrl ?? null,
    logoUrl: logo?.url ?? null,
  }
  const updated = [...concessionarias, created]
  saveConcessionarias(updated)
  return { concessionarias: updated, added: true, updated: false, nome: normalized }
}
