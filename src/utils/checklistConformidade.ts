import normasData from '../config/normas.json'
import type { ChecklistItem, ComplementoChecklistItem, TipoRelatorio } from '../models/Solicitacao'

export interface RequisitoCatalogo {
  id: string
  descricao: string
  categoria?: string
}

export const CATEGORIA_LABELS: Record<string, string> = {
  ORGANIZACAO: 'Organização',
  VOLUME_I: 'Volume I — Relatório Técnico',
  VOLUME_II: 'Volume II — Projetos',
  VOLUME_III: 'Volume III — Documentos Complementares',
  REFERENCIAS: 'Referências',
}

export interface ChecklistItemEnriquecido extends ChecklistItem {
  label: string
  catalogado: boolean
}

export const STATUS_LABELS: Record<ChecklistItem['status'], string> = {
  OK: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  INFORMACAO_AUSENTE: 'Documentação pendente',
}

export type StatusFiltro = 'todos' | ChecklistItem['status']

type TiposProjetoMap = Record<
  TipoRelatorio,
  { nome: string; requisitos: RequisitoCatalogo[] }
>

const tiposProjeto = normasData.tiposProjeto as TiposProjetoMap

export function getTipoProjetoNome(tipo?: TipoRelatorio): string | null {
  if (!tipo) return null
  return tiposProjeto[tipo]?.nome ?? null
}

export function getRequisitosCatalogo(tipos: TipoRelatorio[]): RequisitoCatalogo[] {
  const seen = new Set<string>()
  const result: RequisitoCatalogo[] = []

  for (const tipo of tipos) {
    const requisitos = tiposProjeto[tipo]?.requisitos ?? []
    for (const req of requisitos) {
      if (!seen.has(req.id)) {
        seen.add(req.id)
        result.push(req)
      }
    }
  }

  return result
}

export function getRequisitosEco101(): RequisitoCatalogo[] {
  const cfg = (normasData as { concessionarias?: { eco101?: { requisitos?: RequisitoCatalogo[] } } })
    .concessionarias?.eco101
  return cfg?.requisitos ?? []
}

export function hasCategoriaGrouping(items: ChecklistItem[]): boolean {
  return items.some((item) => !!item.categoria)
}

export function groupItemsByCategoria(
  items: ChecklistItemEnriquecido[],
): Array<{ categoria: string; label: string; items: ChecklistItemEnriquecido[] }> {
  const groups = new Map<string, ChecklistItemEnriquecido[]>()

  for (const item of items) {
    const cat = item.categoria ?? 'OUTROS'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(item)
  }

  const order = ['ORGANIZACAO', 'VOLUME_I', 'VOLUME_II', 'VOLUME_III', 'REFERENCIAS', 'OUTROS']
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    .map(([categoria, groupedItems]) => ({
      categoria,
      label: CATEGORIA_LABELS[categoria] ?? categoria.replace(/_/g, ' '),
      items: groupedItems,
    }))
}

export function getRequisitoDescricao(id: string, tipos?: TipoRelatorio[]): string {
  const eco101Req = getRequisitosEco101().find((r) => r.id === id)
  if (eco101Req) return eco101Req.descricao

  const tiposBusca =
    tipos && tipos.length > 0
      ? tipos
      : (Object.keys(tiposProjeto) as TipoRelatorio[])

  for (const tipo of tiposBusca) {
    const req = tiposProjeto[tipo]?.requisitos.find((r) => r.id === id)
    if (req) return req.descricao
  }

  return formatIdAsLabel(id)
}

function formatIdAsLabel(id: string): string {
  return id
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizarId(id: string): string {
  return id.trim().toUpperCase()
}

export function enriquecerChecklist(
  items: ChecklistItem[],
  tipoRelatorio?: TipoRelatorio,
  concessionariaId?: string | null,
): ChecklistItemEnriquecido[] {
  const eco101Catalogo =
    concessionariaId === 'eco101' ? getRequisitosEco101() : []
  const tipos: TipoRelatorio[] = tipoRelatorio ? [tipoRelatorio] : []
  const catalogo =
    eco101Catalogo.length > 0
      ? eco101Catalogo
      : tipos.length > 0
        ? getRequisitosCatalogo(tipos)
        : []
  const itemMap = new Map<string, ChecklistItem>()

  for (const item of items) {
    const id = normalizarId(item.item)
    if (!id) continue
    itemMap.set(id, { ...item, item: id })
  }

  if (catalogo.length === 0) {
    return items.map((item) => ({
      ...item,
      item: normalizarId(item.item),
      label: getRequisitoDescricao(normalizarId(item.item)),
      catalogado: false,
    }))
  }

  const resultado: ChecklistItemEnriquecido[] = []

  for (const req of catalogo) {
    const existente = itemMap.get(req.id)
    if (existente) {
      resultado.push({
        ...existente,
        categoria: existente.categoria ?? req.categoria,
        label: req.descricao,
        catalogado: true,
      })
      itemMap.delete(req.id)
    } else {
      resultado.push({
        item: req.id,
        categoria: req.categoria,
        status: 'INFORMACAO_AUSENTE',
        situacaoEncontrada: 'Item não retornado na análise — verificar documentação',
        exigenciaNormativa: req.descricao,
        fundamentacao: 'Requisito previsto no catálogo normativo do aplicativo',
        orientacao: `Apresentar ou complementar: ${req.descricao}`,
        label: req.descricao,
        catalogado: true,
      })
    }
  }

  for (const [, item] of itemMap) {
    resultado.push({
      ...item,
      label: getRequisitoDescricao(item.item, tipos),
      catalogado: false,
    })
  }

  return resultado
}

export function parseComplementosChecklist(raw?: string): Record<string, string> {
  if (!raw?.trim()) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return {}

    const map: Record<string, string> = {}
    for (const entry of parsed) {
      const item = String(entry?.item ?? '').trim().toUpperCase()
      const texto = String(entry?.texto ?? '').trim()
      if (item && texto) map[item] = texto
    }
    return map
  } catch {
    return {}
  }
}

export function toComplementosPayload(
  complementos: Record<string, string>,
): ComplementoChecklistItem[] {
  return Object.entries(complementos)
    .map(([item, texto]) => ({
      item: item.trim().toUpperCase(),
      texto: texto.trim(),
    }))
    .filter((c) => c.item && c.texto)
}

export function parseConformidadeChecklist(raw: string): ChecklistItem[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed[0].item || !parsed[0].status) return null
    return parsed as ChecklistItem[]
  } catch {
    return null
  }
}
