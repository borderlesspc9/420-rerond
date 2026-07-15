import { describe, expect, it } from 'vitest'
import {
  buildRelatorioPdfFileName,
  sanitizeText,
  slugifyFilenamePart,
} from './sanitizeText'
import {
  calcularIndicadores,
  montarRelatorioConformidade,
  statusGeralFromIndicadores,
} from './relatorioConformidade'
import type { RelatorioItemDetalhe } from '../models/RelatorioConformidade'

describe('sanitizeText', () => {
  it('remove tags HTML sem executar', () => {
    expect(sanitizeText('<script>alert(1)</script>OK <b>teste</b>')).toBe('OK teste')
  })

  it('preserva acentuação', () => {
    expect(sanitizeText('Não conformidade — análise técnica')).toContain('Não')
  })
})

describe('buildRelatorioPdfFileName', () => {
  it('gera nome seguro no padrão solicitado', () => {
    const name = buildRelatorioPdfFileName({
      concessionaria: 'Ecovias / ECO101',
      projeto: 'Duplicação BR-101',
      data: new Date('2026-07-15T12:00:00Z'),
    })
    expect(name).toBe('relatorio-conformidade-ecovias-eco101-duplicacao-br-101-2026-07-15.pdf')
  })

  it('slugify remove caracteres especiais', () => {
    expect(slugifyFilenamePart('CCR!! Arteris')).toBe('ccr-arteris')
  })
})

describe('montarRelatorioConformidade', () => {
  it('monta indicadores e preserva resultado original da IA', () => {
    const payload = montarRelatorioConformidade({
      solicitacaoId: 'abc-123',
      titulo: 'Projeto teste',
      nomeConcessionaria: 'Ecovias',
      checklistItems: [
        {
          item: 'MEMORIAL',
          status: 'OK',
          situacaoEncontrada: 'Memorial presente',
          exigenciaNormativa: 'Art. 1',
          fundamentacao: 'OK',
          orientacao: '',
        },
        {
          item: 'ART_PDF',
          status: 'NAO_CONFORME',
          situacaoEncontrada: 'ART genérica',
          exigenciaNormativa: 'Art. 2',
          fundamentacao: 'Sem vínculo ao trecho',
          orientacao: 'Reemitir ART',
        },
        {
          item: 'KM_INICIO',
          status: 'INFORMACAO_AUSENTE',
          situacaoEncontrada: 'Não localizado',
          exigenciaNormativa: 'Art. 3',
          fundamentacao: 'Ausente',
          orientacao: 'Informar KM',
        },
      ],
      parecerTecnico: 'Parecer técnico de exemplo com conclusão relevante sobre o projeto.',
      checklistConformidadeRaw: '[{"item":"MEMORIAL"}]',
    })

    expect(payload.indicadores.conformes).toBeGreaterThanOrEqual(1)
    expect(payload.indicadores.naoConformes).toBeGreaterThanOrEqual(1)
    expect(payload.planoAcao.length).toBeGreaterThanOrEqual(1)
    expect(payload.resultadoOriginalIa.checklistConformidade).toBe('[{"item":"MEMORIAL"}]')
    expect(payload.resultadoOriginalIa.parecerTecnico).toContain('Parecer')
    expect(payload.identificadorRelatorio).toMatch(/^RAC-/)
  })
})

describe('calcularIndicadores', () => {
  it('calcula percentual e status geral', () => {
    const itens: RelatorioItemDetalhe[] = [
      {
        codigo: 'A',
        titulo: 'A',
        descricao: '',
        status: 'conforme',
        criticidade: 'baixa',
        resultadoAnalise: 'Conforme',
        justificativaIa: '',
        evidencias: '',
        recomendacao: '',
        referenciaNormativa: '',
        observacoes: '',
      },
      {
        codigo: 'B',
        titulo: 'B',
        descricao: '',
        status: 'nao_conforme',
        criticidade: 'alta',
        resultadoAnalise: 'Não conforme',
        justificativaIa: '',
        evidencias: '',
        recomendacao: '',
        referenciaNormativa: '',
        observacoes: '',
      },
    ]
    const ind = calcularIndicadores(itens)
    expect(ind.totalAnalisados).toBe(2)
    expect(ind.percentualConformidade).toBe(50)
    expect(statusGeralFromIndicadores(ind)).toBe('nao_conforme')
  })
})
