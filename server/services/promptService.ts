import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROMPTS_FILE = path.join(__dirname, '../config/prompts.json')

export interface PromptConfig {
  id: string
  nome: string
  descricao: string
  prompt: string
  ativo: boolean
}

/**
 * Carrega prompts do arquivo de configuração
 */
export function carregarPrompts(): PromptConfig[] {
  try {
    if (fs.existsSync(PROMPTS_FILE)) {
      const data = fs.readFileSync(PROMPTS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Erro ao carregar prompts:', error)
  }
  
  // Retornar prompt padrão se não houver arquivo
  return [getPromptPadrao()]
}

/**
 * Salva prompts no arquivo de configuração
 */
export function salvarPrompts(prompts: PromptConfig[]): void {
  try {
    const dir = path.dirname(PROMPTS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), 'utf-8')
  } catch (error) {
    console.error('Erro ao salvar prompts:', error)
    throw error
  }
}

/**
 * Obtém um prompt por ID
 */
export function obterPromptPorId(id: string): PromptConfig | null {
  const prompts = carregarPrompts()
  return prompts.find(p => p.id === id) || null
}

/**
 * Obtém o prompt ativo padrão
 */
export function obterPromptAtivo(): PromptConfig {
  const prompts = carregarPrompts()
  const promptAtivo = prompts.find(p => p.ativo)
  return promptAtivo || getPromptPadrao()
}

/**
 * Retorna o prompt padrão
 */
function getPromptPadrao(): PromptConfig {
  return {
    id: 'default',
    nome: 'Comparação Formulário x PDFs - SysBaseInfra',
    descricao: 'Compara os dados do formulário de solicitação com os PDFs anexados e indica ok ou informações não batem',
    prompt: `Você é um analista de projetos de infraestrutura rodoviária. Sua tarefa é COMPARAR as informações preenchidas no formulário de solicitação com o conteúdo dos documentos (PDFs) anexados.

DADOS DO FORMULÁRIO DE SOLICITAÇÃO (Overview Dados do cliente e Informações da Obra):
- Cliente: {cliente}
- Kilometragem: {kilometragem}
- Nro Processo ERP: {nroProcessoErp}
- Rodovia: {rodovia}
- Nome Concessionária: {nomeConcessionaria}
- Sentido: {sentido}
- Ocupação: {ocupacao}
- Município - Estado: {municipioEstado}
- Ocupação Área: {ocupacaoArea}
- Responsável Técnico: {responsavelTecnico}
- Fase do Projeto: {faseProjeto}
- Analista Responsável: {analistaResponsavel}
- Memorial: {memorial}
- Data de Recebimento: {dataRecebimento}
- Título: {titulo}
- Tipo de Obra: {tipoObra}
- Localização: {localizacao}
- Descrição: {descricao}

DOCUMENTOS ANEXADOS:
{arquivosInfo}

INSTRUÇÕES:
1. Compare cada informação do formulário com o que consta nos PDFs.
2. Para cada item do checklist, verifique se os dados do formulário batem com os dados dos documentos.
3. Use APENAS uma destas situações para cada campo:
   - "ok" quando as informações do formulário correspondem ao que está nos PDFs.
   - "informações não batem" quando há divergência, ausência ou inconsistência (adicione brevemente a divergência após ponto e vírgula, ex: "informações não batem; KM no formulário difere do PDF").
4. Retorne APENAS um objeto JSON válido, sem alterar os nomes dos campos. Use exatamente as chaves abaixo.

FORMATO DE SAÍDA - OBJETO JSON (use exatamente estes nomes de campos):
{
  "LOCALIZACAO": "ok" ou "informações não batem; [motivo]",
  "KM_INICIO": "ok" ou "informações não batem; [motivo]",
  "KM_FIM": "ok" ou "informações não batem; [motivo]",
  "NOME_BR": "ok" ou "informações não batem; [motivo]",
  "COORDENADAS_GEORREFERENCIAIS_E": "ok" ou "informações não batem; [motivo]",
  "COORDENADAS_GEORREFERENCIAIS_N": "ok" ou "informações não batem; [motivo]",
  "TRACADO_FAIXA_DOMINIO": "ok" ou "informações não batem; [motivo]",
  "COTAS_TEXTOS_LEGIVEIS": "ok" ou "informações não batem; [motivo]",
  "VERIFICACAO_ESCALA": "ok" ou "informações não batem; [motivo]",
  "MEMORIAL": "ok" ou "informações não batem; [motivo]",
  "LARGURA_PISTA_DNIT": "ok" ou "informações não batem; [motivo]",
  "LEGENDAS": "ok" ou "informações não batem; [motivo]",
  "ANOTACAO_NOTA": "ok" ou "informações não batem; [motivo]",
  "SIGLA_ABREVIACAO": "ok" ou "informações não batem; [motivo]",
  "LOC_KM_PREFIXO": "ok" ou "informações não batem; [motivo]",
  "CARIMBO_CORRETO": "ok" ou "informações não batem; [motivo]",
  "LIMITE_PROPRIEDADE": "ok" ou "informações não batem; [motivo]",
  "DELIMITACAO_DOMINIO_NAO_EDIFICANTE": "ok" ou "informações não batem; [motivo]",
  "ART_PDF": "ok" ou "informações não batem; [motivo]",
  "QTD_FOLHAS": "ok" ou "informações não batem; [motivo]"
}

Mapeamento sugerido: Localização do formulário → LOCALIZACAO; Kilometragem → KM_INICIO/KM_FIM; Rodovia → NOME_BR; Memorial → MEMORIAL. Para itens sem correspondência direta no formulário, verifique a presença e consistência nos documentos.

Responda somente com o JSON, sem texto antes ou depois.`,
    ativo: true
  }
}

/**
 * Substitui placeholders no prompt
 */
export function processarPrompt(promptTemplate: string, variaveis: Record<string, string>): string {
  let promptProcessado = promptTemplate
  
  for (const [key, value] of Object.entries(variaveis)) {
    const placeholder = `{${key}}`
    promptProcessado = promptProcessado.replace(new RegExp(placeholder, 'g'), value)
  }
  
  return promptProcessado
}

/**
 * Anexa instruções normativas ao prompt final sem alterar templates existentes.
 */
export function comporPromptComNormas(promptBase: string, blocoNormativo: string): string {
  const base = promptBase.trim()
  const bloco = blocoNormativo.trim()

  if (!bloco) return base
  if (!base) return bloco

  return `${base}\n\n---\nCONTEXTO NORMATIVO PARA CONFORMIDADE\n${bloco}`
}
