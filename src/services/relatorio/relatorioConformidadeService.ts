import { getSessionToken } from '../../auth/session'
import { API_BASE_URL } from '../api/apiBaseUrl'
import type {
  GerarRelatorioPdfResponse,
  RelatorioConformidadePayload,
  RelatorioPdfHistoricoItem,
} from '../../models/RelatorioConformidade'
import { gerarPdfConformidadeNoCliente } from './gerarPdfCliente'

const HISTORY_KEY_PREFIX = 'relatorio-pdf-historico:'

async function authHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
  const token = await getSessionToken()
  const headers: Record<string, string> = { ...extra }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data?.error || data?.message || `Erro HTTP ${response.status}`
  } catch {
    return `Erro HTTP ${response.status}`
  }
}

function loadLocalHistory(solicitacaoId: string): RelatorioPdfHistoricoItem[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${solicitacaoId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RelatorioPdfHistoricoItem[]) : []
  } catch {
    return []
  }
}

function saveLocalHistory(solicitacaoId: string, items: RelatorioPdfHistoricoItem[]) {
  try {
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${solicitacaoId}`, JSON.stringify(items.slice(0, 30)))
  } catch {
    // quota / private mode
  }
}

function pushLocalHistory(solicitacaoId: string, item: RelatorioPdfHistoricoItem) {
  const current = loadLocalHistory(solicitacaoId)
  saveLocalHistory(solicitacaoId, [item, ...current.filter((h) => h.id !== item.id)])
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function gerarPdfViaBackend(
  solicitacaoId: string,
  relatorio: RelatorioConformidadePayload,
  options?: { forceNew?: boolean },
): Promise<GerarRelatorioPdfResponse> {
  const response = await fetch(
    `${API_BASE_URL}/solicitacoes/${encodeURIComponent(solicitacaoId)}/relatorio-pdf`,
    {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        relatorio,
        resultadoOriginalIa: relatorio.resultadoOriginalIa,
        forceNew: options?.forceNew ?? true,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as GerarRelatorioPdfResponse
}

/**
 * Gera o PDF com identidade BaseInfra.
 * Usa geração no navegador (layout do parecer técnico) como caminho principal.
 * Se o backend estiver disponível, também persiste uma cópia no servidor.
 */
export async function gerarRelatorioPdf(
  solicitacaoId: string,
  relatorio: RelatorioConformidadePayload,
  options?: { forceNew?: boolean },
): Promise<GerarRelatorioPdfResponse> {
  // 1) Gera PDF profissional no cliente (parecer técnico + logos)
  const { blob, fileName } = await gerarPdfConformidadeNoCliente(relatorio)
  const localReportId = `local-${Date.now()}`
  const objectUrl = URL.createObjectURL(blob)
  const geradoEm = new Date().toISOString()

  sessionStorage.setItem(`relatorio-pdf-blob:${localReportId}`, objectUrl)

  let versao = loadLocalHistory(solicitacaoId).length + 1
  let reportId = localReportId
  let downloadUrl = objectUrl
  let persistedOnServer = false

  // 2) Tenta persistir no backend (opcional)
  try {
    const data = await gerarPdfViaBackend(solicitacaoId, relatorio, options)
    reportId = data.reportId
    versao = data.versao
    downloadUrl = data.downloadUrl
    persistedOnServer = true
  } catch (apiError) {
    console.warn('Persistência no backend indisponível; PDF local mantido.', apiError)
  }

  const result: GerarRelatorioPdfResponse = {
    reportId,
    versao,
    fileName,
    downloadUrl,
    identificadorRelatorio: relatorio.identificadorRelatorio,
    geradoEm,
  }

  pushLocalHistory(solicitacaoId, {
    id: reportId,
    solicitacaoId,
    identificadorRelatorio: relatorio.identificadorRelatorio,
    versao,
    fileName,
    downloadUrl: persistedOnServer ? downloadUrl : objectUrl,
    geradoEm,
    nomeConcessionaria: relatorio.metadados.nomeConcessionaria,
    nomeProjeto: relatorio.metadados.nomeProjeto,
    percentualConformidade: relatorio.indicadores.percentualConformidade,
    statusGeral: relatorio.statusGeral,
  })

  // Sempre baixa o PDF com layout novo (cliente)
  downloadBlob(blob, fileName)

  return result
}

export async function listarRelatoriosPdf(
  solicitacaoId: string,
): Promise<RelatorioPdfHistoricoItem[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/solicitacoes/${encodeURIComponent(solicitacaoId)}/relatorio-pdf`,
      { headers: await authHeaders() },
    )
    if (response.ok) {
      const remote = (await response.json()) as RelatorioPdfHistoricoItem[]
      const local = loadLocalHistory(solicitacaoId)
      const byId = new Map<string, RelatorioPdfHistoricoItem>()
      for (const item of [...remote, ...local]) byId.set(item.id, item)
      return Array.from(byId.values()).sort((a, b) =>
        String(b.geradoEm).localeCompare(String(a.geradoEm)),
      )
    }
  } catch {
    // API offline — usa histórico local
  }

  return loadLocalHistory(solicitacaoId)
}

export async function baixarRelatorioPdf(
  solicitacaoId: string,
  reportId: string,
  fileName?: string,
): Promise<void> {
  // PDFs gerados localmente
  if (reportId.startsWith('local-')) {
    const objectUrl = sessionStorage.getItem(`relatorio-pdf-blob:${reportId}`)
    const localItem = loadLocalHistory(solicitacaoId).find((h) => h.id === reportId)
    const url = objectUrl || localItem?.downloadUrl
    if (!url) {
      throw new Error('Arquivo local expirado. Gere o PDF novamente.')
    }
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || localItem?.fileName || `relatorio-conformidade-${reportId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }

  const response = await fetch(
    `${API_BASE_URL}/solicitacoes/${encodeURIComponent(solicitacaoId)}/relatorio-pdf/${encodeURIComponent(reportId)}/download`,
    { headers: await authHeaders() },
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const blob = await response.blob()
  downloadBlob(blob, fileName || `relatorio-conformidade-${reportId}.pdf`)
}

export async function uploadLogoConcessionaria(
  file: File,
  nomeConcessionaria: string,
): Promise<{ url: string; dataUrl: string }> {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg']
  if (!allowed.includes(file.type)) {
    throw new Error('Formato inválido. Use PNG ou JPG/JPEG. SVG não é aceito sem processamento seguro.')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('O logotipo deve ter no máximo 2 MB.')
  }

  const dataUrlLocal = await readFileAsDataUrl(file)
  await validateImageDimensions(dataUrlLocal, 40, 40, 2000, 2000)

  try {
    const form = new FormData()
    form.append('logo', file)
    form.append('nomeConcessionaria', nomeConcessionaria)

    const response = await fetch(`${API_BASE_URL}/logos-concessionaria`, {
      method: 'POST',
      headers: await authHeaders(),
      body: form,
    })

    if (response.ok) {
      const data = await response.json()
      return {
        url: String(data.url ?? ''),
        dataUrl: String(data.dataUrl ?? dataUrlLocal),
      }
    }
  } catch {
    // fallback local
  }

  return { url: '', dataUrl: dataUrlLocal }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'))
    reader.readAsDataURL(file)
  })
}

function validateImageDimensions(
  dataUrl: string,
  minW: number,
  minH: number,
  maxW: number,
  maxH: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (img.width < minW || img.height < minH) {
        reject(new Error(`Dimensões mínimas: ${minW}x${minH}px.`))
        return
      }
      if (img.width > maxW || img.height > maxH) {
        reject(new Error(`Dimensões máximas: ${maxW}x${maxH}px.`))
        return
      }
      resolve()
    }
    img.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido.'))
    img.src = dataUrl
  })
}
