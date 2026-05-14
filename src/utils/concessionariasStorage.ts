export const CONCESSIONARIAS_STORAGE_KEY = 'nova-solicitacao:concessionarias'

export const loadConcessionarias = (): string[] => {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(CONCESSIONARIAS_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
  } catch (error) {
    console.error('Erro ao carregar concessionárias do localStorage:', error)
    return []
  }
}

export const saveConcessionarias = (concessionarias: string[]): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONCESSIONARIAS_STORAGE_KEY, JSON.stringify(concessionarias))
}

export const addConcessionaria = (
  concessionarias: string[],
  nome: string
): { concessionarias: string[]; added: boolean; nome: string } => {
  const normalized = nome.trim()
  if (!normalized) {
    return { concessionarias, added: false, nome: normalized }
  }

  const jaExiste = concessionarias.some(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  )

  if (jaExiste) {
    return { concessionarias, added: false, nome: normalized }
  }

  const updated = [...concessionarias, normalized]
  saveConcessionarias(updated)
  return { concessionarias: updated, added: true, nome: normalized }
}
