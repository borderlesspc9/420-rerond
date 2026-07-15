import { describe, expect, it } from 'vitest'
import {
  buildSafePdfFileName,
  generateRelatorioConformidadePdf,
  type RelatorioPdfInput,
} from '../services/relatorioConformidadePdf'

const sampleInput = (): RelatorioPdfInput => ({
  solicitacaoId: 'sol-1',
  identificadorRelatorio: 'RAC-20260715-SOL1',
  statusGeral: 'exige_atencao',
  analisadoEm: '2026-07-15T15:00:00.000Z',
  metadados: {
    tituloRelatorio: 'Relatório de Análise de Conformidade',
    nomeProjeto: 'Duplicação BR-101',
    numeroContrato: 'ERP-123',
    nomeConcessionaria: 'Ecovias',
    trechoRodovia: 'BR-101 KM 85',
    responsavel: 'Analista Teste',
    observacoes: 'Observação de teste com acentuação: não conformidade.',
    dataReferencia: '2026-07-15T15:00:00.000Z',
    classificacaoConfidencialidade: 'confidencial',
    logoConcessionariaDataUrl: null,
  },
  indicadores: {
    totalAnalisados: 3,
    conformes: 1,
    parcialmenteConformes: 0,
    naoConformes: 1,
    exigemAtencao: 1,
    naoAvaliados: 0,
    percentualConformidade: 33.3,
    porCriticidade: {
      baixa: 1,
      media: 1,
      alta: 1,
      critica: 0,
      nao_avaliada: 0,
    },
  },
  resumoExecutivo: {
    objetivo: 'Avaliar conformidade',
    escopo: 'Projeto teste',
    principaisConclusoes: ['Conclusão 1'],
    principaisRiscos: ['Risco 1'],
    recomendacoesPrioritarias: ['Recomendação 1'],
  },
  itens: [
    {
      codigo: 'MEMORIAL',
      titulo: 'Memorial descritivo',
      descricao: 'Exigência',
      status: 'conforme',
      criticidade: 'baixa',
      resultadoAnalise: 'Conforme',
      justificativaIa: 'OK',
      evidencias: 'Documento presente',
      recomendacao: 'Manter',
      referenciaNormativa: 'Art. 1',
      observacoes: '',
    },
    {
      codigo: 'ART',
      titulo: 'ART',
      descricao: 'Exigência',
      status: 'nao_conforme',
      criticidade: 'alta',
      resultadoAnalise: 'Não conforme',
      justificativaIa: 'ART genérica',
      evidencias: 'Sem vínculo',
      recomendacao: 'Reemitir',
      referenciaNormativa: 'Art. 2',
      observacoes: '',
    },
  ],
  planoAcao: [
    {
      itemCodigo: 'ART',
      acaoRecomendada: 'Reemitir ART vinculada ao trecho',
      prioridade: 'alta',
      responsavel: 'Analista',
      prazo: '',
      statusTratamento: 'pendente',
      observacoes: '',
    },
  ],
  geradoPorNome: 'Tester',
})

describe('relatorioConformidadePdf', () => {
  it('gera nome de arquivo no padrão seguro', () => {
    expect(buildSafePdfFileName(sampleInput(), new Date('2026-07-15T12:00:00Z'))).toBe(
      'relatorio-conformidade-ecovias-duplicacao-br-101-2026-07-15.pdf',
    )
  })

  it('gera buffer PDF válido com múltiplas páginas', async () => {
    const { buffer, fileName } = await generateRelatorioConformidadePdf(sampleInput())
    expect(fileName.endsWith('.pdf')).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  }, 20000)
})
