import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { RelatorioConformidadePayload } from '../../models/RelatorioConformidade'
import {
  BASEINFRA_THEME,
  hexToRgbTuple,
  shouldUseEcoviasLogo,
} from '../../config/baseinfraTheme'
import { buildRelatorioPdfFileName } from '../../utils/sanitizeText'
import { STATUS_CONFORMIDADE_LABELS } from '../../utils/relatorioConformidade'

const C = BASEINFRA_THEME.colors
const primary = rgb(...hexToRgbTuple(C.primary900))
const primaryLight = rgb(...hexToRgbTuple(C.primary700))
const accent = rgb(...hexToRgbTuple(C.accent500))
const text = rgb(...hexToRgbTuple(C.text))
const muted = rgb(...hexToRgbTuple(C.textMuted))
const soft = rgb(...hexToRgbTuple(C.primary50))
const white = rgb(1, 1, 1)
const success = rgb(...hexToRgbTuple(C.success))
const danger = rgb(...hexToRgbTuple(C.danger))
const warning = rgb(...hexToRgbTuple(C.warning))
const border = rgb(...hexToRgbTuple(C.border))

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 48
const MARGIN_TOP = 72
const MARGIN_BOTTOM = 56
const CONTENT_W = PAGE_W - MARGIN_X * 2

type MdBlock =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'li'; text: string }
  | { type: 'blank' }

function stripMdInline(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/, '')
    .trim()
}

function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      blocks.push({ type: 'blank' })
      continue
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: stripMdInline(trimmed.slice(2)) })
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: stripMdInline(trimmed.slice(3)) })
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: stripMdInline(trimmed.slice(4)) })
    } else if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'h3', text: stripMdInline(trimmed.slice(5)) })
    } else if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      blocks.push({
        type: 'li',
        text: stripMdInline(trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')),
      })
    } else {
      blocks.push({ type: 'p', text: stripMdInline(trimmed) })
    }
  }
  return blocks
}

function wrapText(textValue: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = textValue.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function formatDate(iso?: string): string {
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

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

function dataUrlToBytes(dataUrl?: string | null): Uint8Array | null {
  if (!dataUrl?.startsWith('data:image')) return null
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg);base64,(.+)$/i)
  if (!match) return null
  const bin = atob(match[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * PDF profissional do parecer técnico com identidade BaseInfra.
 */
export async function gerarPdfConformidadeNoCliente(
  payload: RelatorioConformidadePayload,
): Promise<{ blob: Blob; fileName: string }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const baseLogoBytes = await fetchImageBytes(BASEINFRA_THEME.logoPath)
  let concLogoBytes = dataUrlToBytes(payload.metadados.logoConcessionariaDataUrl)
  if (!concLogoBytes && payload.metadados.logoConcessionariaUrl) {
    concLogoBytes = await fetchImageBytes(payload.metadados.logoConcessionariaUrl)
  }
  if (
    !concLogoBytes &&
    shouldUseEcoviasLogo(payload.metadados.nomeConcessionaria, payload.concessionariaId)
  ) {
    concLogoBytes = await fetchImageBytes(BASEINFRA_THEME.logoConcessionariaDefaultPath)
  }

  const baseLogo = baseLogoBytes ? await safeEmbedPng(doc, baseLogoBytes) : null
  const concLogo = concLogoBytes ? await safeEmbedPng(doc, concLogoBytes) : null

  const parecer =
    payload.resultadoOriginalIa.parecerTecnico?.trim() ||
    buildParecerFallback(payload)

  const titulo =
    payload.metadados.tituloRelatorio?.trim() ||
    BASEINFRA_THEME.tituloPadraoRelatorio

  // ===== CAPA =====
  let page = doc.addPage([PAGE_W, PAGE_H])
  drawPageChrome(page, { cover: true })

  // Faixa lateral de marca
  page.drawRectangle({ x: 0, y: 0, width: 14, height: PAGE_H, color: primary })
  page.drawRectangle({ x: 14, y: 0, width: 4, height: PAGE_H, color: accent })

  // Header logos
  if (baseLogo) {
    const dims = fitImage(baseLogo.width, baseLogo.height, 170, 52)
    page.drawImage(baseLogo, {
      x: MARGIN_X + 10,
      y: PAGE_H - 90,
      width: dims.w,
      height: dims.h,
    })
  } else {
    page.drawText(BASEINFRA_THEME.brandName, {
      x: MARGIN_X + 10,
      y: PAGE_H - 70,
      size: 18,
      font: fontBold,
      color: primary,
    })
  }

  // Logo concessionária (sem contorno, alinhada à BaseInfra)
  if (concLogo) {
    const dims = fitImage(concLogo.width, concLogo.height, 170, 56)
    page.drawImage(concLogo, {
      x: PAGE_W - MARGIN_X - dims.w,
      y: PAGE_H - 94,
      width: dims.w,
      height: dims.h,
    })
  } else {
    const label = payload.metadados.nomeConcessionaria || 'Concessionária'
    page.drawText(label.slice(0, 28), {
      x: PAGE_W - MARGIN_X - 140,
      y: PAGE_H - 70,
      size: 10,
      font: fontBold,
      color: muted,
    })
  }

  let y = PAGE_H - 180
  page.drawText(BASEINFRA_THEME.brandFullName.toUpperCase(), {
    x: MARGIN_X + 10,
    y,
    size: 9,
    font: fontBold,
    color: primaryLight,
  })
  y -= 36

  const titleLines = wrapText(titulo, fontBold, 20, CONTENT_W - 20)
  for (const line of titleLines) {
    page.drawText(line, {
      x: MARGIN_X + 10,
      y,
      size: 20,
      font: fontBold,
      color: primary,
    })
    y -= 26
  }

  y -= 12
  page.drawRectangle({
    x: MARGIN_X + 10,
    y: y + 8,
    width: 80,
    height: 3,
    color: accent,
  })
  y -= 28

  const metaRows: Array<[string, string]> = [
    ['Projeto / processo', payload.metadados.nomeProjeto],
    ['Contrato / ERP', payload.metadados.numeroContrato || '—'],
    ['Concessionária', payload.metadados.nomeConcessionaria || '—'],
    ['Trecho / rodovia', payload.metadados.trechoRodovia || '—'],
    ['Responsável', payload.metadados.responsavel || '—'],
    ['Data da análise', formatDate(payload.analisadoEm)],
    ['Identificador', payload.identificadorRelatorio],
    ['Status geral', STATUS_CONFORMIDADE_LABELS[payload.statusGeral]],
    ['Índice de conformidade', `${payload.indicadores.percentualConformidade}%`],
  ]

  for (const [label, value] of metaRows) {
    page.drawText(`${label}:`, {
      x: MARGIN_X + 10,
      y,
      size: 10,
      font: fontBold,
      color: muted,
    })
    const valueLines = wrapText(value || '—', font, 10, CONTENT_W - 160)
    page.drawText(valueLines[0] || '—', {
      x: MARGIN_X + 150,
      y,
      size: 10,
      font,
      color: text,
    })
    y -= 18
    for (let i = 1; i < valueLines.length; i++) {
      page.drawText(valueLines[i], {
        x: MARGIN_X + 150,
        y,
        size: 10,
        font,
        color: text,
      })
      y -= 16
    }
  }

  y -= 20
  page.drawRectangle({
    x: MARGIN_X + 10,
    y: y - 40,
    width: CONTENT_W - 10,
    height: 56,
    color: soft,
    borderColor: border,
    borderWidth: 0.8,
  })
  page.drawText('Documento técnico com identidade BaseInfra', {
    x: MARGIN_X + 22,
    y: y - 8,
    size: 10,
    font: fontBold,
    color: primary,
  })
  page.drawText(BASEINFRA_THEME.confidentialityDefault, {
    x: MARGIN_X + 22,
    y: y - 26,
    size: 9,
    font,
    color: muted,
  })

  // ===== CORPO DO PARECER =====
  page = doc.addPage([PAGE_W, PAGE_H])
  drawPageChrome(page)
  y = PAGE_H - MARGIN_TOP

  const drawHeaderLogos = (p: PDFPage) => {
    if (baseLogo) {
      const dims = fitImage(baseLogo.width, baseLogo.height, 130, 38)
      p.drawImage(baseLogo, {
        x: MARGIN_X,
        y: PAGE_H - 52,
        width: dims.w,
        height: dims.h,
      })
    }
    if (concLogo) {
      const dims = fitImage(concLogo.width, concLogo.height, 140, 42)
      p.drawImage(concLogo, {
        x: PAGE_W - MARGIN_X - dims.w,
        y: PAGE_H - 54,
        width: dims.w,
        height: dims.h,
      })
    }
    p.drawRectangle({
      x: MARGIN_X,
      y: PAGE_H - 60,
      width: CONTENT_W,
      height: 1.5,
      color: accent,
    })
  }

  drawHeaderLogos(page)

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM + 20) {
      page = doc.addPage([PAGE_W, PAGE_H])
      drawPageChrome(page)
      drawHeaderLogos(page)
      y = PAGE_H - MARGIN_TOP
    }
  }

  const writeLines = (
    lines: string[],
    opts: { size: number; bold?: boolean; color?: RGB; indent?: number; lineGap?: number },
  ) => {
    const f = opts.bold ? fontBold : font
    const color = opts.color ?? text
    const indent = opts.indent ?? 0
    const gap = opts.lineGap ?? 3
    for (const line of lines) {
      ensureSpace(opts.size + gap + 2)
      page.drawText(line, {
        x: MARGIN_X + indent,
        y: y - opts.size,
        size: opts.size,
        font: f,
        color,
      })
      y -= opts.size + gap
    }
  }

  // Título da seção
  writeLines(wrapText(titulo, fontBold, 13, CONTENT_W), {
    size: 13,
    bold: true,
    color: primary,
    lineGap: 5,
  })
  y -= 6

  // Bloco indicadores compacto
  ensureSpace(70)
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 58,
    width: CONTENT_W,
    height: 58,
    color: soft,
    borderColor: border,
    borderWidth: 0.7,
  })
  const cards = [
    { label: 'Conformidade', value: `${payload.indicadores.percentualConformidade}%`, color: primary },
    { label: 'Conformes', value: String(payload.indicadores.conformes), color: success },
    {
      label: 'Atenção',
      value: String(payload.indicadores.exigemAtencao + payload.indicadores.parcialmenteConformes),
      color: warning,
    },
    { label: 'Não conformes', value: String(payload.indicadores.naoConformes), color: danger },
  ]
  cards.forEach((card, i) => {
    const cx = MARGIN_X + 12 + i * (CONTENT_W / 4)
    page.drawText(card.label, { x: cx, y: y - 18, size: 8, font, color: muted })
    page.drawText(card.value, { x: cx, y: y - 40, size: 14, font: fontBold, color: card.color })
  })
  y -= 72

  // Conteúdo do parecer técnico
  const blocks = parseMarkdown(parecer)
  for (const block of blocks) {
    if (block.type === 'blank') {
      y -= 6
      continue
    }
    if (block.type === 'h1') {
      y -= 8
      writeLines(wrapText(block.text, fontBold, 14, CONTENT_W), {
        size: 14,
        bold: true,
        color: primary,
        lineGap: 5,
      })
      page.drawRectangle({
        x: MARGIN_X,
        y: y + 2,
        width: 56,
        height: 2.5,
        color: accent,
      })
      y -= 10
      continue
    }
    if (block.type === 'h2') {
      y -= 10
      ensureSpace(28)
      page.drawRectangle({
        x: MARGIN_X,
        y: y - 18,
        width: CONTENT_W,
        height: 22,
        color: soft,
      })
      page.drawRectangle({
        x: MARGIN_X,
        y: y - 18,
        width: 4,
        height: 22,
        color: primary,
      })
      writeLines(wrapText(block.text, fontBold, 11, CONTENT_W - 16), {
        size: 11,
        bold: true,
        color: primary,
        indent: 12,
        lineGap: 4,
      })
      y -= 6
      continue
    }
    if (block.type === 'h3') {
      y -= 6
      writeLines(wrapText(block.text, fontBold, 10.5, CONTENT_W), {
        size: 10.5,
        bold: true,
        color: primaryLight,
        lineGap: 4,
      })
      y -= 2
      continue
    }
    if (block.type === 'li') {
      const lines = wrapText(`•  ${block.text}`, font, 9.5, CONTENT_W - 8)
      writeLines(lines, { size: 9.5, color: text, indent: 8, lineGap: 3 })
      continue
    }
    writeLines(wrapText(block.text, font, 9.5, CONTENT_W), {
      size: 9.5,
      color: text,
      lineGap: 3.5,
    })
    y -= 2
  }

  // ===== ANEXO: checklist resumido =====
  if (payload.itens.length > 0) {
    page = doc.addPage([PAGE_W, PAGE_H])
    drawPageChrome(page)
    drawHeaderLogos(page)
    y = PAGE_H - MARGIN_TOP

    writeLines(['Anexo — Síntese do checklist de conformidade'], {
      size: 13,
      bold: true,
      color: primary,
      lineGap: 6,
    })
    y -= 8

    for (const item of payload.itens) {
      ensureSpace(52)
      const statusColor =
        item.status === 'conforme'
          ? success
          : item.status === 'nao_conforme'
            ? danger
            : warning

      page.drawRectangle({
        x: MARGIN_X,
        y: y - 44,
        width: CONTENT_W,
        height: 48,
        color: white,
        borderColor: border,
        borderWidth: 0.7,
      })
      page.drawRectangle({
        x: MARGIN_X,
        y: y - 44,
        width: 4,
        height: 48,
        color: statusColor,
      })

      page.drawText(`${item.codigo} — ${truncate(item.titulo, 70)}`, {
        x: MARGIN_X + 12,
        y: y - 14,
        size: 9,
        font: fontBold,
        color: text,
      })
      page.drawText(STATUS_CONFORMIDADE_LABELS[item.status], {
        x: MARGIN_X + 12,
        y: y - 28,
        size: 8,
        font: fontBold,
        color: statusColor,
      })
      page.drawText(truncate(item.evidencias || item.justificativaIa || '—', 95), {
        x: MARGIN_X + 12,
        y: y - 40,
        size: 7.5,
        font,
        color: muted,
      })
      y -= 56
    }
  }

  // Rodapés
  const pages = doc.getPages()
  const emitted = formatDate(new Date().toISOString())
  pages.forEach((p, index) => {
    p.drawRectangle({
      x: MARGIN_X,
      y: 38,
      width: CONTENT_W,
      height: 0.8,
      color: border,
    })
    p.drawText(
      `${BASEINFRA_THEME.brandName} — ${titulo.slice(0, 48)} | ${payload.identificadorRelatorio}`,
      {
        x: MARGIN_X,
        y: 24,
        size: 7,
        font,
        color: muted,
      },
    )
    p.drawText(`Emitido em ${emitted}  ·  Página ${index + 1}/${pages.length}`, {
      x: PAGE_W - MARGIN_X - 150,
      y: 24,
      size: 7,
      font,
      color: muted,
    })
  })

  const bytes = await doc.save()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const fileName = buildRelatorioPdfFileName({
    concessionaria: payload.metadados.nomeConcessionaria,
    projeto: payload.metadados.nomeProjeto,
  })
  return { blob: new Blob([copy], { type: 'application/pdf' }), fileName }
}

function drawPageChrome(page: PDFPage, opts?: { cover?: boolean }) {
  // Fundo suave superior
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 8,
    width: PAGE_W,
    height: 8,
    color: primary,
  })
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 12,
    width: PAGE_W,
    height: 4,
    color: accent,
  })
  if (!opts?.cover) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 8,
      height: PAGE_H,
      color: primary,
    })
  }
}

function fitImage(w: number, h: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / w, maxH / h)
  return { w: w * ratio, h: h * ratio }
}

async function safeEmbedPng(doc: PDFDocument, bytes: Uint8Array) {
  try {
    return await doc.embedPng(bytes)
  } catch {
    try {
      return await doc.embedJpg(bytes)
    } catch {
      return null
    }
  }
}

function truncate(value: string, max: number) {
  const t = String(value || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function buildParecerFallback(payload: RelatorioConformidadePayload): string {
  const lines: string[] = [
    `# ${BASEINFRA_THEME.tituloPadraoRelatorio}`,
    '',
    '## 1. Identificação do Projeto',
    `- Projeto: ${payload.metadados.nomeProjeto}`,
    `- Concessionária: ${payload.metadados.nomeConcessionaria || '—'}`,
    `- Trecho/rodovia: ${payload.metadados.trechoRodovia || '—'}`,
    `- Contrato: ${payload.metadados.numeroContrato || '—'}`,
    `- Responsável: ${payload.metadados.responsavel || '—'}`,
    '',
    '## 2. Resumo da análise',
    payload.resumoExecutivo.objetivo,
    '',
    `Escopo: ${payload.resumoExecutivo.escopo}`,
    '',
    '## 3. Principais conclusões',
    ...payload.resumoExecutivo.principaisConclusoes.map((c) => `- ${c}`),
    '',
    '## 4. Não conformidades e pendências',
  ]

  for (const item of payload.itens.filter((i) => i.status !== 'conforme')) {
    lines.push('')
    lines.push(`### ${item.codigo} — ${item.titulo}`)
    lines.push(`**Situação encontrada:** ${item.evidencias}`)
    lines.push(`**Exigência normativa:** ${item.referenciaNormativa}`)
    lines.push(`**Fundamentação:** ${item.justificativaIa}`)
    lines.push(`**Orientação:** ${item.recomendacao}`)
  }

  lines.push('')
  lines.push('## 5. Conclusão geral')
  lines.push(
    `Status: ${STATUS_CONFORMIDADE_LABELS[payload.statusGeral]} — índice de conformidade ${payload.indicadores.percentualConformidade}%.`,
  )
  for (const r of payload.resumoExecutivo.recomendacoesPrioritarias) {
    lines.push(`- ${r}`)
  }

  return lines.join('\n')
}
