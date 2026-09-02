import normasJson from './normas.json'

export type FonteNormativaCatalogo = {
  id: string
  titulo: string
  orgao: string
  ano: number
  descricao: string
}

export const FONTES_NORMATIVAS: FonteNormativaCatalogo[] = normasJson.fontes

export const TIPOS_PROJETO_CATALOGO = normasJson.tiposProjeto

export function getRequisitosCatalogoPorConcessionaria(
  concessionariaId: string,
): Array<{ id: string; descricao: string; categoria?: string }> {
  const catalog = normasJson.concessionarias as Record<
    string,
    { requisitos?: Array<{ id: string; descricao: string; categoria?: string }> }
  >
  return catalog[concessionariaId]?.requisitos ?? []
}
