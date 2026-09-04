export type TipoAnaliseCategoria =
  | 'ocupacao_faixa'
  | 'acesso'
  | 'pac'
  | 'rede_eletrica'
  | 'esgoto'
  | 'publicidade'
  | 'sinalizacao'
  | 'outro'

export type TipoAnalise = {
  id: string
  nome: string
  slug: string
  categoria: TipoAnaliseCategoria
  descricao: string
  finalidade?: string
  /** IDs de normas do catálogo ou custom. */
  normasFontes: string[]
  /** IDs de documentos esperados (catálogo ou custom). */
  documentosSugeridos: string[]
  /** Checklist próprio deste tipo (não misturar com outros). */
  requisitos: Array<{ id: string; descricao: string; categoria?: string }>
  promptOrientacao?: string
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type TipoAnaliseDraft = Omit<TipoAnalise, 'id' | 'createdAt' | 'updatedAt' | 'ativo'> & {
  id?: string
  ativo?: boolean
}

export const TIPOS_ANALISE_SEED: TipoAnalise[] = [
  {
    id: 'ocupacao-faixa',
    nome: 'Ocupação em faixa de domínio',
    slug: 'ocupacao-faixa',
    categoria: 'ocupacao_faixa',
    descricao: 'Análise de ocupações (redes, travessias, interferências) na faixa de domínio.',
    finalidade: 'Verificar conformidade documental e técnica de ocupação.',
    normasFontes: ['ANTT_SUROD_13_2025'],
    documentosSugeridos: [
      'requerimento',
      'memorial_descritivo',
      'planta_baixa',
      'perfil_ocupacao',
      'art',
    ],
    requisitos: [],
    promptOrientacao:
      'Use somente requisitos de ocupação em faixa de domínio. Não aplique checklist de acesso ou PAC.',
    ativo: true,
  },
  {
    id: 'acesso',
    nome: 'Acessos',
    slug: 'acesso',
    categoria: 'acesso',
    descricao: 'Análise de projetos de acesso à rodovia / propriedade lindeira.',
    finalidade: 'Verificar conformidade de acessos.',
    normasFontes: ['ANTT_SUROD_13_2025'],
    documentosSugeridos: ['requerimento', 'memorial_descritivo', 'planta_baixa', 'art'],
    requisitos: [],
    promptOrientacao:
      'Use somente requisitos de acesso. Não misture itens exclusivos de ocupação ou PAC.',
    ativo: true,
  },
  {
    id: 'pac',
    nome: 'PAC',
    slug: 'pac',
    categoria: 'pac',
    descricao: 'Análise de Projetos de Adequação / PAC conforme material da organização.',
    finalidade: 'Verificar conformidade de PAC.',
    normasFontes: ['ANTT_SUROD_12_2025'],
    documentosSugeridos: ['requerimento', 'memorial_descritivo', 'plano_trabalho', 'art'],
    requisitos: [],
    promptOrientacao:
      'Use somente requisitos de PAC. Não aplique checklist de ocupação ou acesso.',
    ativo: true,
  },
  {
    id: 'outro',
    nome: 'Outro',
    slug: 'outro',
    categoria: 'outro',
    descricao: 'Tipo extensível — descrever a finalidade na solicitação ou no cadastro.',
    finalidade: 'Casos pontuais sem tipo pré-cadastrado.',
    normasFontes: [],
    documentosSugeridos: [],
    requisitos: [],
    promptOrientacao:
      'Tipo Outro: use apenas normas e documentos informados nesta solicitação/perfil. Não invente checklist de outro domínio.',
    ativo: true,
  },
]
