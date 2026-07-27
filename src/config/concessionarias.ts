export type ConcessionariaId = 'eco101' | 'motiva' | 'arteris' | 'outra'

export interface ConcessionariaConfig {
  id: Exclude<ConcessionariaId, 'outra'>
  nome: string
  promptProfile: 'eco101' | 'motiva' | 'arteris' | 'default'
  logoPath: string
  aliases: string[]
}

export const CONCESSIONARIAS: ConcessionariaConfig[] = [
  {
    id: 'eco101',
    nome: 'Ecovias / ECO101',
    promptProfile: 'eco101',
    logoPath: '/logo-ecovias.png',
    aliases: ['ecovias', 'eco101', 'eco 101'],
  },
  {
    id: 'motiva',
    nome: 'Motiva',
    promptProfile: 'motiva',
    logoPath: '/logo-motiva.png',
    aliases: ['motiva', 'ccr', 'grupo ccr'],
  },
  {
    id: 'arteris',
    nome: 'Arteris',
    promptProfile: 'arteris',
    logoPath: '/logo-arteris.png',
    aliases: ['arteris'],
  },
]

export const OUTRA_CONCESSIONARIA_VALUE = '__outra__'

/** @deprecated Use o id da concessionária no select. Mantido por compatibilidade. */
export const ECO101_SELECT_VALUE = 'eco101'

export function getConcessionariaById(id?: string | null) {
  if (!id) return null
  return CONCESSIONARIAS.find((item) => item.id === id) ?? null
}

export function resolveConcessionaria(
  nomeConcessionaria?: string | null,
  concessionariaId?: string | null,
): ConcessionariaConfig | null {
  const byId = getConcessionariaById(concessionariaId)
  if (byId) return byId

  const n = (nomeConcessionaria || '').toLowerCase().trim()
  if (!n) return null

  return (
    CONCESSIONARIAS.find(
      (item) =>
        item.nome.toLowerCase() === n ||
        item.aliases.some((alias) => n.includes(alias)),
    ) ?? null
  )
}

export function getLogoPathForConcessionaria(
  nomeConcessionaria?: string | null,
  concessionariaId?: string | null,
): string | null {
  return resolveConcessionaria(nomeConcessionaria, concessionariaId)?.logoPath ?? null
}
