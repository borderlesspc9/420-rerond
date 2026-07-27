import type { ChecklistItem } from '../models/Solicitacao'
import type {
  MontarRelatorioInput,
  RelatorioAcaoPlano,
  RelatorioConformidadePayload,
  RelatorioIndicadores,
  RelatorioItemDetalhe,
  RelatorioMetadadosEditaveis,
  StatusConformidadeItem,
} from '../models/RelatorioConformidade'
import type { CriticidadeNivel } from '../config/baseinfraTheme'
import { BASEINFRA_THEME } from '../config/baseinfraTheme'
import { getConcessionariaById } from '../config/concessionarias'
import { enriquecerChecklist } from './checklistConformidade'
import { formatDateIsoLocal, sanitizeText } from './sanitizeText'

function mapStatus(status: ChecklistItem['status']): StatusConformidadeItem {
  if (status === 'OK') return 'conforme'
  if (status === 'NAO_CONFORME') return 'nao_conforme'
  return 'exige_atencao'
}

function inferCriticidade(
  status: StatusConformidadeItem,
  texto: string,
): CriticidadeNivel {
  if (status === 'conforme') return 'baixa'
  if (status === 'nao_avaliado') return 'nao_avaliada'

  const lower = texto.toLowerCase()
  if (
    lower.includes('crítico') ||
    lower.includes('critico') ||
    lower.includes('segurança') ||
    lower.includes('seguranca') ||
    lower.includes('grave')
  ) {
    return 'critica'
  }
  if (status === 'nao_conforme') return 'alta'
  if (status === 'exige_atencao' || status === 'parcialmente_conforme') return 'media'
  return 'nao_avaliada'
}

function buildIdentificador(solicitacaoId: string, date = new Date()): string {
  const short = solicitacaoId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
  const stamp = formatDateIsoLocal(date).replace(/-/g, '')
  return `RAC-${stamp}-${short || 'XXXX'}`
}

function extrairConclusoesDoParecer(parecer?: string): string[] {
  if (!parecer?.trim()) return []
  const lines = parecer
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 40)
  return lines.slice(0, 4).map((l) => sanitizeText(l, 400))
}

export function calcularIndicadores(itens: RelatorioItemDetalhe[]): RelatorioIndicadores {
  const porCriticidade: RelatorioIndicadores['porCriticidade'] = {
    baixa: 0,
    media: 0,
    alta: 0,
    critica: 0,
    nao_avaliada: 0,
  }

  let conformes = 0
  let parcialmenteConformes = 0
  let naoConformes = 0
  let exigemAtencao = 0
  let naoAvaliados = 0

  for (const item of itens) {
    porCriticidade[item.criticidade] += 1
    switch (item.status) {
      case 'conforme':
        conformes += 1
        break
      case 'parcialmente_conforme':
        parcialmenteConformes += 1
        break
      case 'nao_conforme':
        naoConformes += 1
        break
      case 'exige_atencao':
        exigemAtencao += 1
        break
      default:
        naoAvaliados += 1
    }
  }

  const totalAnalisados = itens.length
  const pesoConforme = conformes + parcialmenteConformes * 0.5
  const percentualConformidade =
    totalAnalisados === 0
      ? 0
      : Math.round((pesoConforme / totalAnalisados) * 1000) / 10

  return {
    totalAnalisados,
    conformes,
    parcialmenteConformes,
    naoConformes,
    exigemAtencao,
    naoAvaliados,
    percentualConformidade,
    porCriticidade,
  }
}

export function statusGeralFromIndicadores(
  indicadores: RelatorioIndicadores,
): StatusConformidadeItem {
  if (indicadores.totalAnalisados === 0) return 'nao_avaliado'
  if (indicadores.naoConformes > 0) return 'nao_conforme'
  if (indicadores.exigemAtencao > 0 || indicadores.parcialmenteConformes > 0) {
    return 'exige_atencao'
  }
  if (indicadores.naoAvaliados === indicadores.totalAnalisados) return 'nao_avaliado'
  return 'conforme'
}

export const STATUS_CONFORMIDADE_LABELS: Record<StatusConformidadeItem, string> = {
  conforme: 'Conforme',
  parcialmente_conforme: 'Parcialmente conforme',
  nao_conforme: 'Não conforme',
  exige_atencao: 'Exige atenção',
  nao_avaliado: 'Não avaliado',
}

export const CONFIDENCIALIDADE_LABELS: Record<
  RelatorioMetadadosEditaveis['classificacaoConfidencialidade'],
  string
> = {
  publico: 'Público',
  interno: 'Uso interno',
  confidencial: 'Confidencial',
  restrito: 'Restrito',
}

export function montarRelatorioConformidade(
  input: MontarRelatorioInput,
): RelatorioConformidadePayload {
  const enriquecidos = enriquecerChecklist(
    input.checklistItems,
    input.tipoRelatorio,
    input.concessionariaId,
  )

  const itens: RelatorioItemDetalhe[] = enriquecidos.map((item) => {
    const status = mapStatus(item.status)
    const evidencias = sanitizeText(item.situacaoEncontrada)
    const justificativa = sanitizeText(item.fundamentacao)
    const recomendacao = sanitizeText(item.orientacao)
    const referencia = sanitizeText(item.exigenciaNormativa)
    const criticidade = inferCriticidade(
      status,
      `${evidencias} ${justificativa} ${recomendacao}`,
    )

    return {
      codigo: sanitizeText(item.item, 80),
      titulo: sanitizeText(item.label, 200),
      descricao: sanitizeText(item.exigenciaNormativa || item.label, 500),
      status,
      criticidade,
      resultadoAnalise: STATUS_CONFORMIDADE_LABELS[status],
      justificativaIa: justificativa || '—',
      evidencias: evidencias || '—',
      recomendacao: status === 'conforme' ? 'Manter conformidade.' : recomendacao || '—',
      referenciaNormativa: referencia || '—',
      observacoes: '',
      categoria: item.categoria,
    }
  })

  const indicadores = calcularIndicadores(itens)
  const statusGeral = statusGeralFromIndicadores(indicadores)

  const planoAcao: RelatorioAcaoPlano[] = itens
    .filter((i) => i.status === 'nao_conforme' || i.status === 'exige_atencao')
    .map((i) => ({
      itemCodigo: i.codigo,
      acaoRecomendada: i.recomendacao,
      prioridade: i.criticidade,
      responsavel: sanitizeText(input.analistaResponsavel || input.responsavelTecnico || ''),
      prazo: '',
      statusTratamento: 'pendente' as const,
      observacoes: '',
    }))

  const trecho =
    [input.rodovia, input.kilometragem, input.localizacao].filter(Boolean).join(' — ') ||
    sanitizeText(input.localizacao || '')

  const nomeConcessionaria =
    sanitizeText(input.nomeConcessionaria || '') ||
    getConcessionariaById(input.concessionariaId)?.nome ||
    ''

  const metadadosBase: RelatorioMetadadosEditaveis = {
    tituloRelatorio: BASEINFRA_THEME.tituloPadraoRelatorio,
    nomeProjeto: sanitizeText(input.titulo),
    numeroContrato: sanitizeText(input.nroProcessoErp || ''),
    nomeConcessionaria,
    trechoRodovia: sanitizeText(trecho),
    responsavel: sanitizeText(
      input.analistaResponsavel ||
        input.usuarioAtual?.displayName ||
        input.usuarioAtual?.email ||
        '',
    ),
    observacoes: sanitizeText(input.descricao || ''),
    dataReferencia: input.analisadoEm
      ? new Date(input.analisadoEm).toISOString()
      : new Date().toISOString(),
    classificacaoConfidencialidade: 'confidencial',
    logoConcessionariaUrl: null,
    logoConcessionariaDataUrl: null,
    ...input.metadadosOverrides,
  }

  // Re-sanitize override fields
  metadadosBase.tituloRelatorio = sanitizeText(metadadosBase.tituloRelatorio, 200)
  metadadosBase.nomeProjeto = sanitizeText(metadadosBase.nomeProjeto, 200)
  metadadosBase.numeroContrato = sanitizeText(metadadosBase.numeroContrato, 100)
  metadadosBase.nomeConcessionaria = sanitizeText(metadadosBase.nomeConcessionaria, 150)
  metadadosBase.trechoRodovia = sanitizeText(metadadosBase.trechoRodovia, 200)
  metadadosBase.responsavel = sanitizeText(metadadosBase.responsavel, 150)
  metadadosBase.observacoes = sanitizeText(metadadosBase.observacoes, 2000)

  const conclusoesParecer = extrairConclusoesDoParecer(input.parecerTecnico)
  const principaisRiscos = itens
    .filter((i) => i.status === 'nao_conforme')
    .slice(0, 5)
    .map((i) => `${i.codigo}: ${i.titulo}`)

  const recomendacoesPrioritarias = planoAcao
    .slice(0, 5)
    .map((a) => sanitizeText(a.acaoRecomendada, 300))

  const analisadoEm = input.analisadoEm
    ? new Date(input.analisadoEm).toISOString()
    : new Date().toISOString()

  return {
    solicitacaoId: input.solicitacaoId,
    identificadorRelatorio: buildIdentificador(input.solicitacaoId, new Date(analisadoEm)),
    statusGeral,
    analisadoEm,
    geradoPorUid: input.usuarioAtual?.uid ?? null,
    geradoPorNome:
      input.usuarioAtual?.displayName || input.usuarioAtual?.email || null,
    metadados: metadadosBase,
    indicadores,
    resumoExecutivo: {
      objetivo:
        'Avaliar a conformidade documental e técnica do projeto perante os requisitos normativos e contratuais aplicáveis.',
      escopo: sanitizeText(
        [
          metadadosBase.nomeProjeto,
          metadadosBase.trechoRodovia,
          metadadosBase.nomeConcessionaria,
          input.tipoRelatorio ? `Tipo: ${input.tipoRelatorio}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        500,
      ),
      principaisConclusoes:
        conclusoesParecer.length > 0
          ? conclusoesParecer
          : [
              `Índice de conformidade: ${indicadores.percentualConformidade}%.`,
              `${indicadores.conformes} item(ns) conforme(s), ${indicadores.naoConformes} não conforme(s), ${indicadores.exigemAtencao} exigem atenção.`,
            ],
      principaisRiscos:
        principaisRiscos.length > 0
          ? principaisRiscos
          : ['Nenhum risco crítico de não conformidade identificado nos itens avaliados.'],
      recomendacoesPrioritarias:
        recomendacoesPrioritarias.length > 0
          ? recomendacoesPrioritarias
          : ['Manter controles documentais e atualizar evidências conforme evolução do projeto.'],
    },
    itens,
    planoAcao,
    tipoRelatorio: input.tipoRelatorio,
    concessionariaId: input.concessionariaId,
    resultadoOriginalIa: {
      checklistConformidade: input.checklistConformidadeRaw,
      parecerTecnico: input.parecerTecnico,
      relatorioIA: input.relatorioIA,
      dadosExtraidos: input.dadosExtraidos ?? null,
      conferenciaInputs: input.conferenciaInputs,
    },
  }
}

export function aplicarMetadadosAoPayload(
  payload: RelatorioConformidadePayload,
  metadados: RelatorioMetadadosEditaveis,
): RelatorioConformidadePayload {
  return {
    ...payload,
    metadados: {
      ...payload.metadados,
      tituloRelatorio: sanitizeText(metadados.tituloRelatorio, 200),
      nomeProjeto: sanitizeText(metadados.nomeProjeto, 200),
      numeroContrato: sanitizeText(metadados.numeroContrato, 100),
      nomeConcessionaria: sanitizeText(metadados.nomeConcessionaria, 150),
      trechoRodovia: sanitizeText(metadados.trechoRodovia, 200),
      responsavel: sanitizeText(metadados.responsavel, 150),
      observacoes: sanitizeText(metadados.observacoes, 2000),
      dataReferencia: metadados.dataReferencia || payload.metadados.dataReferencia,
      classificacaoConfidencialidade: metadados.classificacaoConfidencialidade,
      logoConcessionariaUrl: metadados.logoConcessionariaUrl ?? null,
      logoConcessionariaDataUrl: metadados.logoConcessionariaDataUrl ?? null,
    },
    // Preserva resultado original da IA
    resultadoOriginalIa: payload.resultadoOriginalIa,
  }
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`
}

export function formatDateTimeBr(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export { BASEINFRA_THEME }
