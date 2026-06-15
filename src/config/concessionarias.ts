export type ConcessionariaId = 'eco101' | 'outra'

export interface ConcessionariaConfig {
  id: ConcessionariaId
  nome: string
  promptProfile: 'eco101' | 'default'
}

export const CONCESSIONARIAS: ConcessionariaConfig[] = [
  {
    id: 'eco101',
    nome: 'Ecovias / ECO101',
    promptProfile: 'eco101',
  },
]

export const ECO101_SELECT_VALUE = '__eco101__'
export const OUTRA_CONCESSIONARIA_VALUE = '__outra__'

export function getConcessionariaById(id?: string | null) {
  return CONCESSIONARIAS.find((item) => item.id === id) ?? null
}
