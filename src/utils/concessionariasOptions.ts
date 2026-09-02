import { CONCESSIONARIAS } from '../config/concessionarias'
import type { ConcessionariaPerfil } from '../models/ConcessionariaPerfil'

export type ConcessionariaOption = {
  id: string
  nome: string
  source: 'builtin' | 'firestore' | 'local'
  perfilCompleto?: boolean
  logoUrl?: string | null
  logoDataUrl?: string | null
}

export function buildConcessionariaOptions(
  firestoreProfiles: ConcessionariaPerfil[] = [],
): ConcessionariaOption[] {
  const builtin: ConcessionariaOption[] = CONCESSIONARIAS.map((item) => ({
    id: item.id,
    nome: item.nome,
    source: 'builtin',
    perfilCompleto: true,
  }))

  const builtinIds = new Set(builtin.map((item) => item.id))
  const fromFirestore: ConcessionariaOption[] = firestoreProfiles
    .filter((item) => item.ativo && !builtinIds.has(item.id))
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      source: 'firestore',
      perfilCompleto: item.perfilCompleto,
      logoUrl: item.logoUrl,
      logoDataUrl: item.logoDataUrl,
    }))

  return [...builtin, ...fromFirestore]
}

export function findConcessionariaOption(
  options: ConcessionariaOption[],
  value: string,
): ConcessionariaOption | null {
  return options.find((item) => item.id === value || item.nome === value) ?? null
}
