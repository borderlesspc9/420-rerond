import type { TipoDocumentoAnexo } from '../models/Solicitacao'

export const TIPOS_DOCUMENTO_OPTIONS: Array<{
  value: TipoDocumentoAnexo
  label: string
}> = [
  { value: 'requerimento', label: 'Requerimento' },
  { value: 'memorial_descritivo', label: 'Memorial Descritivo' },
  { value: 'plano_trabalho', label: 'Plano de Trabalho' },
  { value: 'planta_baixa', label: 'Planta Baixa' },
  { value: 'perfil_ocupacao', label: 'Perfil da Ocupação' },
  { value: 'projeto_sinalizacao', label: 'Projeto de Sinalização' },
  { value: 'art', label: 'ART' },
  { value: 'cronograma', label: 'Cronograma' },
  { value: 'declaracao_veracidade', label: 'Declaração de Veracidade' },
  { value: 'licenca_ambiental', label: 'Licença Ambiental / Dispensa' },
  { value: 'parecer_concessionaria', label: 'Parecer da Concessionária' },
  { value: 'documento_complementar', label: 'Documento Complementar' },
  { value: 'desconhecido', label: 'Desconhecido' },
]

export function getFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}
