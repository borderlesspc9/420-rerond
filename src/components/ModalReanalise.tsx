import { useEffect, useState, useRef } from 'react'
import { X, Sparkles, Upload, FileText } from 'lucide-react'
import './ModalReanalise.css'

const TIPOS_PROJETO_OPTIONS = [
  { value: 'duplicacao', label: 'Duplicação' },
  { value: 'recapeamento', label: 'Recapeamento' },
  { value: 'reforma', label: 'Reforma' },
  { value: 'construcao', label: 'Construção' },
  { value: 'manutencao', label: 'Manutenção' },
]

interface ModalReanaliseProps {
  titulo: string
  tipoObraAtual?: string
  primeiraAnalise: boolean
  onConfirm: (
    promptCustomizado?: string,
    novosPDFs?: File[],
    tiposProjetoPraComparar?: string[]
  ) => Promise<void>
  onClose: () => void
}

export default function ModalReanalise({ 
  titulo, 
  tipoObraAtual,
  primeiraAnalise,
  onConfirm, 
  onClose 
}: ModalReanaliseProps) {
  const [promptCustomizado, setPromptCustomizado] = useState('')
  const [usarPromptCustomizado, setUsarPromptCustomizado] = useState(false)
  const [novosPDFs, setNovosPDFs] = useState<File[]>([])
  const [tiposProjetoSelecionados, setTiposProjetoSelecionados] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const tipoNormalizado = (tipoObraAtual || '').trim().toLowerCase()
    if (!tipoNormalizado) {
      setTiposProjetoSelecionados([])
      return
    }

    const existeNoCatalogo = TIPOS_PROJETO_OPTIONS.some(option => option.value === tipoNormalizado)
    setTiposProjetoSelecionados(existeNoCatalogo ? [tipoNormalizado] : [])
  }, [tipoObraAtual])

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
    setLoading(true)

    try {
      await onConfirm(
        usarPromptCustomizado && promptCustomizado ? promptCustomizado : undefined,
        novosPDFs.length > 0 ? novosPDFs : undefined,
        tiposProjetoSelecionados.length > 0 ? tiposProjetoSelecionados : undefined
      )
      onClose()
    } catch (error: any) {
      setErro(error.message || 'Erro ao analisar solicitação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-reanalise-overlay" onClick={onClose}>
      <div className="modal-reanalise-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-reanalise-header">
          <div className="modal-reanalise-header-content">
            <Sparkles size={24} className="modal-reanalise-icon" />
            <h2>{primeiraAnalise ? 'Primeira Análise' : 'Reanalisar com IA'}</h2>
          </div>
          <button className="modal-reanalise-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-reanalise-body">
          <p className="modal-reanalise-description">
            {primeiraAnalise ? (
              <>
                A solicitação <strong>"{titulo}"</strong> será analisada pela IA pela primeira vez.
                Você pode adicionar PDFs adicionais e usar um prompt customizado para uma análise mais específica.
              </>
            ) : (
              <>
                A solicitação <strong>"{titulo}"</strong> será reenviada para análise pela IA.
                Você pode adicionar novos PDFs e usar um prompt customizado para uma análise mais específica.
              </>
            )}
          </p>

          <form onSubmit={handleSubmit}>
            {/* Seção de Upload de PDFs */}
            <div className="modal-reanalise-section">
              <label className="modal-reanalise-section-title">
                Delimitação de Tipos para Comparação Normativa
              </label>
              <p className="modal-reanalise-section-description">
                A IA compara os documentos com as normas dos tipos selecionados. Se nada for marcado,
                o backend usa o tipo da solicitação como fallback.
              </p>
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
                Segure Ctrl (ou Cmd no Mac) para selecionar mais de um tipo.
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

            {/* Seção de Prompt Customizado */}
            <div className="modal-reanalise-section">
              <div className="modal-reanalise-option">
                <label className="modal-reanalise-checkbox-label">
                  <input
                    type="checkbox"
                    checked={usarPromptCustomizado}
                    onChange={(e) => setUsarPromptCustomizado(e.target.checked)}
                  />
                  <span>Usar prompt customizado</span>
                </label>
              </div>

              {usarPromptCustomizado && (
                <div className="modal-reanalise-prompt-group">
                  <label htmlFor="prompt-customizado">Prompt Customizado</label>
                  <textarea
                    id="prompt-customizado"
                    value={promptCustomizado}
                    onChange={(e) => setPromptCustomizado(e.target.value)}
                    placeholder="Ex: Analise focando em aspectos ambientais e impacto ecológico..."
                    rows={6}
                    className="modal-reanalise-textarea"
                  />
                  <p className="modal-reanalise-hint">
                    Descreva o tipo de análise que deseja. A IA usará este prompt junto com as informações da solicitação e documentos (incluindo os PDFs adicionados acima).
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
