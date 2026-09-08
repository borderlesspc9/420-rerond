import { useEffect, useState, useRef } from 'react'
import { X, Sparkles, Upload, FileText } from 'lucide-react'
import type { EscopoAnalise } from '../models/Solicitacao'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'
import './ModalReanalise.css'

const TIPOS_PROJETO_OPTIONS = [
  { value: 'pit', label: 'PIT — Projeto de Interesse de Terceiros' },
  { value: 'obra_per', label: 'Obra prevista no PER' },
  { value: 'obra_nao_per', label: 'Obra não PER' },
] as const

interface ModalReanaliseProps {
  titulo: string
  tipoRelatorioAtual?: string
  /** Tipo de análise (domínio) já vinculado à solicitação — não misturar na reanálise. */
  tipoAnaliseNome?: string | null
  concessionariaId?: string | null
  numeroRevisao?: string | null
  processoId?: string | null
  primeiraAnalise: boolean
  onConfirm: (
    promptCustomizado?: string,
    novosPDFs?: File[],
    tiposProjetoPraComparar?: string[],
    escopoAnalise?: EscopoAnalise
  ) => Promise<void>
  onClose: () => void
}

export default function ModalReanalise({ 
  titulo, 
  tipoRelatorioAtual,
  tipoAnaliseNome,
  concessionariaId,
  numeroRevisao,
  processoId,
  primeiraAnalise,
  onConfirm, 
  onClose 
}: ModalReanaliseProps) {
  const [promptCustomizado, setPromptCustomizado] = useState('')
  const [usarPromptCustomizado, setUsarPromptCustomizado] = useState(false)
  const [novosPDFs, setNovosPDFs] = useState<File[]>([])
  const [tiposProjetoSelecionados, setTiposProjetoSelecionados] = useState<string[]>([])
  const [escopoAnalise, setEscopoAnalise] = useState<EscopoAnalise>({
    incluirDadosFormulario: true,
    incluirDocumentosProjeto: true,
    gerarChecklistConformidade: true,
    gerarParecerTecnico: true,
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const overlayDismiss = useOverlayDismiss(loading ? undefined : onClose)

  useEffect(() => {
    const tipoNormalizado = (tipoRelatorioAtual || '').trim().toLowerCase()
    const existeNoCatalogo = TIPOS_PROJETO_OPTIONS.some(
      (option) => option.value === tipoNormalizado,
    )

    if (existeNoCatalogo) {
      setTiposProjetoSelecionados([tipoNormalizado])
      return
    }

    if (concessionariaId === 'eco101' || concessionariaId === 'motiva' || concessionariaId === 'arteris') {
      setTiposProjetoSelecionados(['pit'])
      return
    }

    setTiposProjetoSelecionados([])
  }, [tipoRelatorioAtual, concessionariaId])

  const handleTipoProjetoChange = (selectedOptions: HTMLSelectElement['selectedOptions']) => {
    const values = Array.from(selectedOptions).map(option => option.value)
    setTiposProjetoSelecionados(values)
  }

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const validFiles = Array.from(selectedFiles).filter(file => {
      const maxSize = 50 * 1024 * 1024 // 50MB
      const validTypes = ['application/pdf']
      
      if (file.size > maxSize) {
        alert(`O arquivo ${file.name} excede o tamanho máximo de 50MB`)
        return false
      }
      
      if (!validTypes.includes(file.type)) {
        alert(`O arquivo ${file.name} não é um PDF válido`)
        return false
      }
      
      return true
    })

    setNovosPDFs(prev => [...prev, ...validFiles])
  }

  const handleRemoveFile = (index: number) => {
    setNovosPDFs(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!escopoAnalise.incluirDadosFormulario && !escopoAnalise.incluirDocumentosProjeto) {
      setErro('Selecione ao menos uma fonte de dados para a IA (formulário ou documentos).')
      return
    }

    if (!escopoAnalise.gerarChecklistConformidade && !escopoAnalise.gerarParecerTecnico) {
      setErro('Selecione ao menos uma saída (checklist ou parecer técnico).')
      return
    }

    setLoading(true)

    try {
      await onConfirm(
        usarPromptCustomizado && promptCustomizado ? promptCustomizado : undefined,
        novosPDFs.length > 0 ? novosPDFs : undefined,
        tiposProjetoSelecionados.length > 0 ? tiposProjetoSelecionados : undefined,
        escopoAnalise
      )
      onClose()
    } catch (error: any) {
      setErro(error.message || 'Erro ao analisar solicitação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-reanalise-overlay"
      onMouseDown={overlayDismiss.onMouseDown}
      onClick={overlayDismiss.onClick}
    >
      <div className="modal-reanalise-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-reanalise-header">
          <div className="modal-reanalise-header-content">
            <Sparkles size={24} className="modal-reanalise-icon" />
            <h2>{primeiraAnalise ? 'Primeira Análise' : 'Reanalisar com IA'}</h2>
          </div>
          <button
            className="modal-reanalise-close"
            onClick={onClose}
            disabled={loading}
            aria-disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-reanalise-body">
          <p className="modal-reanalise-description">
            {primeiraAnalise ? (
              <>
                A solicitação <strong>"{titulo}"</strong> será analisada pela IA pela primeira vez.
                Você pode adicionar PDFs adicionais e uma instrução só desta análise.
              </>
            ) : (
              <>
                A solicitação <strong>"{titulo}"</strong> será reanalisada. A IA receberá a análise
                anterior (checklist, parecer e pendências), os documentos já anexados e eventuais
                PDFs novos. A versão anterior permanece arquivada e acessível no relatório.
              </>
            )}
          </p>

          {!primeiraAnalise && (
            <div className="modal-reanalise-continuidade">
              Memória ativa: itens não contestados tendem a permanecer; mudanças de status devem
              vir com justificativa. Instrução abaixo vale só nesta execução (não é feedback
              permanente — isso fica em Configurações).
            </div>
          )}

          {processoId && numeroRevisao && /^R0*[1-9]\d*$/i.test(numeroRevisao) ? (
            <div className="modal-reanalise-continuidade">
              Continuidade de processo: a IA também receberá checklist, parecer e pendências da
              revisão anterior do mesmo processo, além dos documentos desta revisão ({numeroRevisao}).
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            {/* Seção de Upload de PDFs */}
            <div className="modal-reanalise-section">
              <label className="modal-reanalise-section-title">
                Escopo da Análise de IA
              </label>
              <p className="modal-reanalise-section-description">
                Defina exatamente quais informações entram na análise e quais saídas o sistema deve gerar.
              </p>

              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={escopoAnalise.incluirDadosFormulario}
                    onChange={(e) =>
                      setEscopoAnalise((prev) => ({
                        ...prev,
                        incluirDadosFormulario: e.target.checked,
                      }))
                    }
                  />
                  <span>Usar dados do formulário da solicitação</span>
                </label>
              </div>

              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={escopoAnalise.incluirDocumentosProjeto}
                    onChange={(e) =>
                      setEscopoAnalise((prev) => ({
                        ...prev,
                        incluirDocumentosProjeto: e.target.checked,
                      }))
                    }
                  />
                  <span>Usar documentos anexados (PDFs do projeto)</span>
                </label>
              </div>

              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={escopoAnalise.gerarChecklistConformidade}
                    onChange={(e) =>
                      setEscopoAnalise((prev) => ({
                        ...prev,
                        gerarChecklistConformidade: e.target.checked,
                      }))
                    }
                  />
                  <span>Gerar checklist de conformidade</span>
                </label>
              </div>

              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={escopoAnalise.gerarParecerTecnico}
                    onChange={(e) =>
                      setEscopoAnalise((prev) => ({
                        ...prev,
                        gerarParecerTecnico: e.target.checked,
                      }))
                    }
                  />
                  <span>Gerar parecer técnico em markdown</span>
                </label>
              </div>
            </div>

            <div className="modal-reanalise-section">
              <label className="modal-reanalise-section-title">
                Delimitação de Tipos para Comparação Normativa
              </label>
              {tipoAnaliseNome ? (
                <p className="modal-reanalise-section-description">
                  Tipo de análise desta solicitação: <strong>{tipoAnaliseNome}</strong>.
                  A IA usa o checklist deste domínio; os tipos abaixo são apenas o enquadramento
                  normativo PIT/PER (legado), não misturam ocupação × acesso × PAC.
                </p>
              ) : (
                <p className="modal-reanalise-section-description">
                  A IA compara os documentos com as normas dos tipos selecionados. Se nada for marcado,
                  o backend usa o tipo da solicitação como fallback. Prefira vincular um tipo de
                  análise (ocupação/acesso/PAC) na edição da solicitação.
                </p>
              )}
              <select
                multiple
                className="modal-reanalise-select"
                value={tiposProjetoSelecionados}
                onChange={(e) => handleTipoProjetoChange(e.target.selectedOptions)}
              >
                {TIPOS_PROJETO_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="modal-reanalise-hint">
                Segure Ctrl (ou Cmd no Mac) para selecionar mais de um tipo normativo (PIT/PER).
              </p>
            </div>

            <div className="modal-reanalise-section">
              <label className="modal-reanalise-section-title">
                <FileText size={18} />
                Adicionar PDFs para Análise
              </label>
              <p className="modal-reanalise-section-description">
                Adicione PDFs adicionais que serão analisados pela IA junto com os documentos já anexados.
              </p>
              
              <div
                className={`modal-reanalise-upload-area ${novosPDFs.length > 0 ? 'has-files' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="modal-reanalise-upload-icon" />
                <p className="modal-reanalise-upload-text">
                  Clique para selecionar PDFs ou arraste arquivos aqui
                </p>
                <p className="modal-reanalise-upload-info">
                  Apenas PDFs (máx. 50MB por arquivo)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  style={{ display: 'none' }}
                />
              </div>

              {novosPDFs.length > 0 && (
                <div className="modal-reanalise-files-list">
                  {novosPDFs.map((file, index) => (
                    <div key={index} className="modal-reanalise-file-item">
                      <FileText size={16} />
                      <span className="modal-reanalise-file-name">{file.name}</span>
                      <span className="modal-reanalise-file-size">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <button
                        type="button"
                        className="modal-reanalise-file-remove"
                        onClick={() => handleRemoveFile(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instrução só desta reanálise (não treina / não é feedback permanente) */}
            <div className="modal-reanalise-section">
              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={usarPromptCustomizado}
                    onChange={(e) => setUsarPromptCustomizado(e.target.checked)}
                  />
                  <span>Instrução só desta reanálise</span>
                </label>
              </div>

              {usarPromptCustomizado && (
                <div className="modal-reanalise-prompt-group">
                  <label htmlFor="prompt-customizado">Instrução para esta execução</label>
                  <textarea
                    id="prompt-customizado"
                    value={promptCustomizado}
                    onChange={(e) => setPromptCustomizado(e.target.value)}
                    placeholder="Ex.: Reavalie o item de ART; o memorial novo corrige afastamentos laterais..."
                    rows={6}
                    className="modal-reanalise-textarea"
                  />
                  <p className="modal-reanalise-hint">
                    Vale apenas para esta execução. Não treina a IA e não substitui feedback
                    permanente (Configurações → aprendizado). Edição manual do parecer/checklist
                    também não cria aprendizado.
                  </p>
                </div>
              )}
            </div>

            {erro && (
              <div className="modal-reanalise-error">
                {erro}
              </div>
            )}

            <div className="modal-reanalise-actions">
              <button
                type="button"
                className="modal-reanalise-btn-cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="modal-reanalise-btn-confirm"
                disabled={loading || (usarPromptCustomizado && !promptCustomizado.trim())}
              >
                {loading ? 'Analisando...' : primeiraAnalise ? 'Analisar' : 'Reanalisar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
