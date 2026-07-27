import {
  getLogoPathForConcessionaria,
  resolveConcessionaria,
} from './concessionarias'

/**
 * Identidade visual BaseInfra para relatórios PDF e UI.
 */
export const BASEINFRA_THEME = {
  brandName: 'BaseInfra',
  brandFullName: 'BaseInfra Projetos e Consultoria',
  logoPath: '/logo420.png',
  /** Fallback histórico (Ecovias). Preferir getLogoConcessionariaPath(). */
  logoConcessionariaDefaultPath: '/logo-ecovias.png',
  tituloPadraoRelatorio: 'Relatório de Análise Técnica – Ocupação em Faixa de Domínio',
  fontFamily: "'Avenir Next', Avenir, 'Segoe UI', sans-serif",
  colors: {
    primary900: '#0f2f73',
    primary800: '#163f97',
    primary700: '#2357c4',
    primary600: '#2d67db',
    primary100: '#ddeaff',
    primary50: '#f2f8ff',
    accent500: '#f1b726',
    accent100: '#fff4d1',
    text: '#14233d',
    textMuted: '#5d708e',
    border: '#d5e3f5',
    surface: '#ffffff',
    success: '#1e9f63',
    successBg: '#e9f9f1',
    warning: '#d18807',
    warningBg: '#fff6de',
    danger: '#db3648',
    dangerBg: '#ffecee',
    neutral: '#6b7280',
    neutralBg: '#f3f4f6',
  },
  confidentialityDefault: 'Confidencial — uso interno e partes autorizadas',
} as const

export type CriticidadeNivel = 'baixa' | 'media' | 'alta' | 'critica' | 'nao_avaliada'

export const CRITICIDADE_COLORS: Record<CriticidadeNivel, string> = {
  baixa: BASEINFRA_THEME.colors.success,
  media: BASEINFRA_THEME.colors.warning,
  alta: BASEINFRA_THEME.colors.danger,
  critica: '#9f1239',
  nao_avaliada: BASEINFRA_THEME.colors.neutral,
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

export function getLogoConcessionariaPath(
  nomeConcessionaria?: string | null,
  concessionariaId?: string | null,
): string | null {
  return getLogoPathForConcessionaria(nomeConcessionaria, concessionariaId)
}

/** @deprecated Preferir getLogoConcessionariaPath */
export function shouldUseEcoviasLogo(
  nomeConcessionaria?: string | null,
  concessionariaId?: string | null,
) {
  return resolveConcessionaria(nomeConcessionaria, concessionariaId)?.id === 'eco101'
}
