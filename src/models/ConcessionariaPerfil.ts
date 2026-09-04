export type PromptProfileId = 'eco101' | 'motiva' | 'arteris' | 'default' | 'custom'
export type TipoProjetoPadrao = 'pit' | 'obra_per' | 'obra_nao_per'

export type RequisitoChecklist = {
  id: string
  descricao: string
  categoria?: string
}

export type ModeloRelatorioConfig = {
  tituloPadrao: string
  descricao?: string
  templateMarkdown: string
}

/** Norma cadastrada no perfil (fora do catálogo JSON embutido). */
export type NormaCustom = {
  id: string
  titulo: string
  orgao: string
  ano?: number | null
  descricao: string
  /** Nome original do arquivo, se houver. */
  arquivoNome?: string | null
  arquivoUrl?: string | null
  arquivoStoragePath?: string | null
  origem: 'manual' | 'arquivo'
}

/** Tipo de documento obrigatório cadastrado no perfil (fora do catálogo fixo). */
export type DocumentoObrigatorioCustom = {
  id: string
  label: string
  descricao?: string
}

export type ConcessionariaPerfil = {
  id: string
  nome: string
  aliases: string[]
  ativo: boolean
  promptProfile: PromptProfileId
  templateId?: string | null
  rodovia?: string
  tipoProjetoPadrao: TipoProjetoPadrao
  normasFontes: string[]
  /** Metadados das normas custom referenciadas em `normasFontes`. */
  normasCustom?: NormaCustom[]
  modeloRelatorio: ModeloRelatorioConfig
  /** IDs do catálogo e/ou de `documentosCustom`. */
  documentosObrigatorios: string[]
  documentosCustom?: DocumentoObrigatorioCustom[]
  requisitos: RequisitoChecklist[]
  logoUrl?: string | null
  logoDataUrl?: string | null
  perfilCompleto: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type ConcessionariaPerfilDraft = Omit<
  ConcessionariaPerfil,
  'id' | 'ativo' | 'perfilCompleto' | 'createdAt' | 'updatedAt'
> & {
  id?: string
}

export const WIZARD_STEPS = [
  { id: 'dados', label: 'Concessionária', description: 'Nome e identificação' },
  { id: 'normas', label: 'Normas', description: 'Fontes normativas' },
  { id: 'modelo', label: 'Modelo de relatório', description: 'Template opcional' },
  { id: 'documentos', label: 'Documentos', description: 'Documentos obrigatórios' },
  { id: 'checklist', label: 'Regras / Checklist', description: 'Requisitos de conformidade' },
  { id: 'logo', label: 'Logo', description: 'Identidade visual' },
  { id: 'revisao', label: 'Revisão', description: 'Confirmar e ativar perfil' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']
