export type TipoAnaliseCategoria =
  | 'ocupacao_faixa'
  | 'acesso'
  | 'pac'
  | 'rede_eletrica'
  | 'esgoto'
  | 'publicidade'
  | 'sinalizacao'
  | 'outro'

export type RequisitoTipoAnalise = {
  id: string
  descricao: string
  categoria?: string
}

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
  requisitos: RequisitoTipoAnalise[]
  promptOrientacao?: string
  ativo: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type TipoAnaliseDraft = Omit<TipoAnalise, 'id' | 'createdAt' | 'updatedAt' | 'ativo'> & {
  id?: string
  ativo?: boolean
}

/** Requisitos exclusivos — IDs prefixados por domínio para detectar misturas em testes. */
const REQ_OCUPACAO: RequisitoTipoAnalise[] = [
  {
    id: 'OCUP_COMPLETUDE_DOCUMENTAL',
    descricao: 'Completude da documentação de ocupação em faixa de domínio (requerimento, memorial, plantas).',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'OCUP_LOCALIZACAO_KM',
    descricao: 'Localização da ocupação com km e sentido coerentes no memorial e nas plantas.',
    categoria: 'GEOMETRIA',
  },
  {
    id: 'OCUP_FAIXA_DOMINIO',
    descricao: 'Interferência com faixa de domínio / non aedificandi identificada e compatível com a norma.',
    categoria: 'GEOMETRIA',
  },
  {
    id: 'OCUP_PERFIL_TRAVESSIA',
    descricao: 'Perfil / seção da ocupação ou travessia com cotas e afastamentos mínimos.',
    categoria: 'GEOMETRIA',
  },
  {
    id: 'OCUP_ART_PROJETO',
    descricao: 'ART referente ao projeto de ocupação apresentada e vinculada ao responsável técnico.',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'OCUP_INTERFERENCIA_PISTA',
    descricao: 'Avaliação de interferência com pista, acostamento e dispositivos de segurança.',
    categoria: 'SEGURANCA',
  },
]

const REQ_ACESSO: RequisitoTipoAnalise[] = [
  {
    id: 'ACESSO_COMPLETUDE_DOCUMENTAL',
    descricao: 'Completude documental do projeto de acesso (requerimento, memorial, planta).',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'ACESSO_GEOMETRIA_ENTRADA',
    descricao: 'Geometria da entrada/saída (raios, ângulos, larguras) conforme diretrizes de acesso.',
    categoria: 'GEOMETRIA',
  },
  {
    id: 'ACESSO_VISIBILIDADE',
    descricao: 'Distâncias de visibilidade e sinalização de alerta no acesso à rodovia.',
    categoria: 'SEGURANCA',
  },
  {
    id: 'ACESSO_DRENAGEM',
    descricao: 'Solução de drenagem do acesso sem comprometer a plataforma da rodovia.',
    categoria: 'DRENAGEM',
  },
  {
    id: 'ACESSO_ART',
    descricao: 'ART do projeto de acesso vinculada ao responsável técnico.',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'ACESSO_PROPRIEDADE_LINDEIRA',
    descricao: 'Identificação da propriedade lindeira e finalidade do acesso.',
    categoria: 'DOCUMENTAL',
  },
]

const REQ_PAC: RequisitoTipoAnalise[] = [
  {
    id: 'PAC_COMPLETUDE_DOCUMENTAL',
    descricao: 'Completude documental do PAC / plano de adequação (requerimento, memorial, plano de trabalho).',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'PAC_ESCOPO_ADEQUACAO',
    descricao: 'Escopo das adequações proposto está descrito e coerente com o diagnóstico.',
    categoria: 'TECNICO',
  },
  {
    id: 'PAC_CRONOGRAMA',
    descricao: 'Cronograma / plano de trabalho das adequações apresentado.',
    categoria: 'PLANEJAMENTO',
  },
  {
    id: 'PAC_PARAMETROS_DESEMPENHO',
    descricao: 'Parâmetros técnicos e de desempenho das adequações compatíveis com o referencial normativo.',
    categoria: 'TECNICO',
  },
  {
    id: 'PAC_ART',
    descricao: 'ART do PAC vinculada ao responsável técnico.',
    categoria: 'DOCUMENTAL',
  },
  {
    id: 'PAC_CHECKLIST_VERIFICACAO',
    descricao: 'Check-list ou verificação de adequação preenchido quando exigido pela organização.',
    categoria: 'DOCUMENTAL',
  },
]

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
    requisitos: REQ_OCUPACAO,
    promptOrientacao:
      'ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo OCUP_ / domínio ocupação em faixa. NÃO aplique checklist de acesso (ACESSO_*) nem PAC (PAC_*). Não invente requisitos de outros tipos.',
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
    requisitos: REQ_ACESSO,
    promptOrientacao:
      'ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo ACESSO_ / domínio acessos. NÃO aplique checklist de ocupação (OCUP_*) nem PAC (PAC_*). Não invente requisitos de outros tipos.',
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
    requisitos: REQ_PAC,
    promptOrientacao:
      'ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo PAC_ / domínio PAC. NÃO aplique checklist de ocupação (OCUP_*) nem acesso (ACESSO_*). Não invente requisitos de outros tipos.',
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
      'Tipo Outro: use apenas normas, documentos e requisitos informados nesta solicitação/perfil. NÃO importe checklist de ocupação, acesso ou PAC. Não invente requisitos de outro domínio.',
    ativo: true,
  },
]
