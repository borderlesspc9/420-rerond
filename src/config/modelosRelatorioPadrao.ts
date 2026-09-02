import type {
  ConcessionariaPerfilDraft,
  ModeloRelatorioConfig,
  RequisitoChecklist,
} from '../models/ConcessionariaPerfil'
import type { TipoDocumentoAnexo } from '../models/Solicitacao'

export type ModeloRelatorioPadrao = {
  id: string
  nome: string
  grupo: 'ecovias' | 'generico'
  descricao: string
  rodovia?: string
  promptProfile: 'eco101' | 'motiva' | 'arteris' | 'default'
  normasFontes: string[]
  documentosObrigatorios: TipoDocumentoAnexo[]
  requisitos: RequisitoChecklist[]
  modeloRelatorio: ModeloRelatorioConfig
}

const ECOVIAS_DOCUMENTOS: TipoDocumentoAnexo[] = [
  'requerimento',
  'memorial_descritivo',
  'plano_trabalho',
  'planta_baixa',
  'perfil_ocupacao',
  'projeto_sinalizacao',
  'art',
  'cronograma',
  'declaracao_veracidade',
  'licenca_ambiental',
]

const ECOVIAS_NORMAS = ['ANTT_SUROD_12_2025', 'ANTT_SUROD_13_2025']

function buildEcoviasRequisitos(prefix: string, nomeConcessionaria: string): RequisitoChecklist[] {
  return [
    {
      id: `${prefix}_ORGANIZACAO_PASTAS`,
      descricao: `Documentação organizada em volumes conforme padrão ${nomeConcessionaria}: Volume I - Relatório Técnico, Volume II - Projetos, Volume III - Documentos Complementares.`,
      categoria: 'ORGANIZACAO',
    },
    {
      id: `${prefix}_CODIFICACAO_ARQUIVOS`,
      descricao: 'Arquivos nomeados conforme codificação aplicável da ANTT/SUROD e diretrizes da concessionária.',
      categoria: 'ORGANIZACAO',
    },
    {
      id: `${prefix}_MEMORIAL_DESCRITIVO`,
      descricao: 'Memorial Descritivo contendo descrição da ocupação, localização quilométrica, características técnicas, materiais, método construtivo, parâmetros geométricos e justificativa técnica.',
      categoria: 'VOLUME_I',
    },
    {
      id: `${prefix}_PLANO_TRABALHO`,
      descricao: 'Plano de Trabalho contendo sequência das atividades, procedimentos construtivos, mobilização, sinalização, interferência no tráfego e recomposição da área afetada.',
      categoria: 'VOLUME_I',
    },
    {
      id: `${prefix}_PLANTA_BAIXA`,
      descricao: 'Planta Baixa com eixo da via, pista, acostamento, faixa de domínio, faixa non aedificandi, posição da ocupação, coordenadas e afastamentos laterais.',
      categoria: 'VOLUME_II',
    },
    {
      id: `${prefix}_PERFIL_OCUPACAO`,
      descricao: 'Perfil da Ocupação demonstrando relação geométrica com greide, terreno natural, altura livre ou cobrimento mínimo, conforme tipo de intervenção.',
      categoria: 'VOLUME_II',
    },
    {
      id: `${prefix}_PROJETO_SINALIZACAO`,
      descricao: 'Projeto de Sinalização de Obra compatível com o tipo de intervenção, contendo distâncias de pré-sinalização, dispositivos, sentidos de tráfego e áreas de atividade.',
      categoria: 'VOLUME_II',
    },
    {
      id: `${prefix}_ESPECIFICACOES_TECNICAS`,
      descricao: 'Especificações técnicas e referências normativas aplicáveis: DNIT, ANTT/SUROD, ABNT e diretrizes da concessionária.',
      categoria: 'VOLUME_II',
    },
    {
      id: `${prefix}_REQUERIMENTO`,
      descricao: 'Requerimento contendo identificação do interessado, contatos, data, descrição do pleito e localização quilométrica.',
      categoria: 'VOLUME_III',
    },
    {
      id: `${prefix}_DECLARACAO_VERACIDADE`,
      descricao: 'Declaração de Veracidade com identificação do interessado, responsável técnico, data e assinaturas.',
      categoria: 'VOLUME_III',
    },
    {
      id: `${prefix}_ART`,
      descricao: 'ART registrada e quitada, vinculada especificamente ao objeto, local, rodovia, km e ocupação em faixa de domínio.',
      categoria: 'VOLUME_III',
    },
    {
      id: `${prefix}_CRONOGRAMA`,
      descricao: 'Cronograma de execução em dias, com prazo total e etapas principais da implantação.',
      categoria: 'VOLUME_III',
    },
    {
      id: `${prefix}_LICENCA_AMBIENTAL`,
      descricao: 'Licença Ambiental ou documento de comprovação de inexigibilidade/dispensa, quando aplicável.',
      categoria: 'VOLUME_III',
    },
  ]
}

function buildEcoviasModeloMarkdown(nomeConcessionaria: string, rodovia?: string): string {
  const rodoviaLabel = rodovia ? ` (${rodovia})` : ''
  return `## 1. Identificação do Projeto
- Interessado
- Concessionária: ${nomeConcessionaria}${rodoviaLabel}
- Rodovia / Quilometragem
- Município/UF
- Tipo de intervenção
- Número da ART
- Responsável técnico

## 2. Análise Documental

### 2.1 Volume I — Relatório Técnico
#### 2.1.1 Memorial Descritivo
#### 2.1.2 Plano de Trabalho

### 2.2 Volume II — Projetos
#### 2.2.1 Planta Baixa
#### 2.2.2 Perfil da Ocupação
#### 2.2.3 Projeto de Sinalização de Obra
#### 2.2.4 Especificações Técnicas

### 2.3 Volume III — Documentos Complementares
#### 2.3.1 Requerimento
#### 2.3.2 Declaração de Veracidade
#### 2.3.3 ART
#### 2.3.4 Cronograma
#### 2.3.5 Licença Ambiental

## 3. Conclusão
## 4. Referências Normativas`
}

const ECOVIAS_TEMPLATES: ModeloRelatorioPadrao[] = [
  {
    id: 'ecovias-rio-minas',
    nome: 'Ecovias Rio Minas',
    grupo: 'ecovias',
    descricao: 'Modelo para ocupação em faixa de domínio — Ecovias Rio Minas (BR-116 / trecho RJ-MG).',
    rodovia: 'BR-116',
    promptProfile: 'eco101',
    normasFontes: ECOVIAS_NORMAS,
    documentosObrigatorios: ECOVIAS_DOCUMENTOS,
    requisitos: buildEcoviasRequisitos('ERM', 'Ecovias Rio Minas'),
    modeloRelatorio: {
      tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
      descricao: 'Template Ecovias Rio Minas baseado no padrão ECO101.',
      templateMarkdown: buildEcoviasModeloMarkdown('Ecovias Rio Minas', 'BR-116'),
    },
  },
  {
    id: 'ecovias-minas-goias',
    nome: 'Ecovias Minas Goiás',
    grupo: 'ecovias',
    descricao: 'Modelo para ocupação em faixa de domínio — Ecovias Minas Goiás.',
    rodovia: 'BR-050 / BR-365',
    promptProfile: 'eco101',
    normasFontes: ECOVIAS_NORMAS,
    documentosObrigatorios: ECOVIAS_DOCUMENTOS,
    requisitos: buildEcoviasRequisitos('EMG', 'Ecovias Minas Goiás'),
    modeloRelatorio: {
      tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
      descricao: 'Template Ecovias Minas Goiás baseado no padrão ECO101.',
      templateMarkdown: buildEcoviasModeloMarkdown('Ecovias Minas Goiás', 'BR-050 / BR-365'),
    },
  },
  {
    id: 'ecovias-araguaia',
    nome: 'Ecovias Araguaia',
    grupo: 'ecovias',
    descricao: 'Modelo para ocupação em faixa de domínio — Ecovias Araguaia.',
    rodovia: 'BR-153',
    promptProfile: 'eco101',
    normasFontes: ECOVIAS_NORMAS,
    documentosObrigatorios: ECOVIAS_DOCUMENTOS,
    requisitos: buildEcoviasRequisitos('EAR', 'Ecovias Araguaia'),
    modeloRelatorio: {
      tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
      descricao: 'Template Ecovias Araguaia baseado no padrão ECO101.',
      templateMarkdown: buildEcoviasModeloMarkdown('Ecovias Araguaia', 'BR-153'),
    },
  },
  {
    id: 'ecovias-cerrado',
    nome: 'Ecovias Cerrado',
    grupo: 'ecovias',
    descricao: 'Modelo para ocupação em faixa de domínio — Ecovias Cerrado.',
    rodovia: 'BR-050',
    promptProfile: 'eco101',
    normasFontes: ECOVIAS_NORMAS,
    documentosObrigatorios: ECOVIAS_DOCUMENTOS,
    requisitos: buildEcoviasRequisitos('ECR', 'Ecovias Cerrado'),
    modeloRelatorio: {
      tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
      descricao: 'Template Ecovias Cerrado baseado no padrão ECO101.',
      templateMarkdown: buildEcoviasModeloMarkdown('Ecovias Cerrado', 'BR-050'),
    },
  },
  {
    id: 'ecovias-ponte',
    nome: 'Ecovias Ponte',
    grupo: 'ecovias',
    descricao: 'Modelo para ocupação em faixa de domínio — Ecovias Ponte.',
    rodovia: 'Concessão Ponte',
    promptProfile: 'eco101',
    normasFontes: ECOVIAS_NORMAS,
    documentosObrigatorios: ECOVIAS_DOCUMENTOS,
    requisitos: buildEcoviasRequisitos('EPT', 'Ecovias Ponte'),
    modeloRelatorio: {
      tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
      descricao: 'Template Ecovias Ponte baseado no padrão ECO101.',
      templateMarkdown: buildEcoviasModeloMarkdown('Ecovias Ponte', 'Concessão Ponte'),
    },
  },
]

const GENERIC_PIT_TEMPLATE: ModeloRelatorioPadrao = {
  id: 'pit-generico',
  nome: 'PIT — Modelo genérico ANTT',
  grupo: 'generico',
  descricao: 'Modelo genérico para Projeto de Interesse de Terceiros (PIT) conforme Portaria SUROD 13/2025.',
  promptProfile: 'default',
  normasFontes: ['ANTT_SUROD_13_2025'],
  documentosObrigatorios: [
    'requerimento',
    'memorial_descritivo',
    'art',
    'cronograma',
    'declaracao_veracidade',
    'licenca_ambiental',
    'parecer_concessionaria',
  ],
  requisitos: [
    { id: 'PIT_COMPLETUDE', descricao: 'Completude da documentação protocolada (Art. 3º)', categoria: 'ORGANIZACAO' },
    { id: 'PIT_CARTA', descricao: 'Carta de solicitação do PIT (Art. 5º, I)', categoria: 'VOLUME_I' },
    { id: 'PIT_PARECER', descricao: 'Parecer Técnico da Concessionária (Art. 5º, II)', categoria: 'VOLUME_I' },
    { id: 'PIT_DECLARACAO', descricao: 'Declaração de Veracidade (Art. 5º, III)', categoria: 'VOLUME_III' },
    { id: 'PIT_FORMULARIO', descricao: 'Formulário de PIT preenchido (Art. 5º, IV)', categoria: 'VOLUME_I' },
    { id: 'PIT_ART', descricao: 'ART do projeto e execução (Art. 5º, d, I)', categoria: 'VOLUME_III' },
    { id: 'PIT_LICENCA', descricao: 'Licença ambiental ou justificativa (Art. 5º, d, II)', categoria: 'VOLUME_III' },
    { id: 'PIT_CRONOGRAMA', descricao: 'Cronograma de execução (Art. 5º, d, III)', categoria: 'VOLUME_III' },
  ],
  modeloRelatorio: {
    tituloPadrao: 'Parecer Técnico — PIT',
    descricao: 'Estrutura genérica ANTT/SUROD para PIT.',
    templateMarkdown: `## 1. Identificação do Projeto
## 2. Análise Documental
### 2.1 Volume I — Relatório Técnico
### 2.2 Volume II — Projetos
### 2.3 Volume III — Documentos Complementares
## 3. Conclusão
## 4. Referências Normativas`,
  },
}

export const MODELOS_RELATORIO_PADRAO: ModeloRelatorioPadrao[] = [
  ...ECOVIAS_TEMPLATES,
  GENERIC_PIT_TEMPLATE,
]

export function getModeloPadraoById(id?: string | null): ModeloRelatorioPadrao | null {
  if (!id) return null
  return MODELOS_RELATORIO_PADRAO.find((item) => item.id === id) ?? null
}

export function applyModeloPadraoToDraft(
  template: ModeloRelatorioPadrao,
  nomeConcessionaria: string,
): Partial<ConcessionariaPerfilDraft> {
  return {
    nome: nomeConcessionaria || template.nome,
    aliases: [template.nome.toLowerCase(), template.id],
    promptProfile: template.promptProfile,
    templateId: template.id,
    rodovia: template.rodovia,
    tipoProjetoPadrao: template.grupo === 'ecovias' ? 'pit' : 'pit',
    normasFontes: [...template.normasFontes],
    documentosObrigatorios: [...template.documentosObrigatorios],
    requisitos: template.requisitos.map((item) => ({ ...item })),
    modeloRelatorio: { ...template.modeloRelatorio },
  }
}

export function slugifyConcessionariaNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export const EMPTY_DRAFT: ConcessionariaPerfilDraft = {
  nome: '',
  aliases: [],
  promptProfile: 'default',
  templateId: null,
  rodovia: '',
  tipoProjetoPadrao: 'pit',
  normasFontes: ['ANTT_SUROD_13_2025'],
  modeloRelatorio: {
    tituloPadrao: 'Parecer Técnico — Ocupação em Faixa de Domínio',
    descricao: '',
    templateMarkdown: '',
  },
  documentosObrigatorios: [],
  requisitos: [],
  logoUrl: null,
  logoDataUrl: null,
}
