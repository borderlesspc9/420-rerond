import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { createSolicitacao } from '../services/solicitacao/solicitacaoService'
import {
  addConcessionaria,
  loadConcessionarias,
  saveConcessionarias,
} from '../utils/concessionariasStorage'
import './NovaSolicitacao.css'

const TIPOS_PROJETO_NORMATIVO = [
  { value: '', label: 'Não informado (a IA infere automaticamente)' },
  { value: 'pit', label: 'PIT — Projeto de Interesse de Terceiros' },
  { value: 'obra_per', label: 'Obra prevista no PER' },
  { value: 'obra_nao_per', label: 'Obra não prevista no PER' },
] as const

const CLASSIFICACOES = [
  { value: 'tipo_01_acesso', label: 'Tipo 01 - ACESSO' },
  { value: 'tipo_02_ocupacao', label: 'Tipo 02 - OCUPAÇÃO' },
  { value: 'tipo_03_publicidade', label: 'Tipo 03 - PUBLICIDADE' },
] as const

const PORTES_POR_CLASSIFICACAO: Record<string, string[]> = {
  tipo_01_acesso: ['VMD < 10', '10 < VMD < 200', 'VMD > 200'],
  tipo_02_ocupacao: [
    '0 - 100 m²',
    '101 - 1.000 m²',
    '1.001 - 10.000 m²',
    'Acima de 10.001 m²',
  ],
  tipo_03_publicidade: ['Simples', 'Energizado', 'Pórtico e Semi-Pórtico'],
}

type FormData = {
  cliente: string
  kilometragem: string
  nroProcessoErp: string
  rodovia: string
  nomeConcessionaria: string
  sentido: string
  ocupacao: string
  municipioEstado: string
  ocupacaoArea: string
  responsavelTecnico: string
  faseProjeto: string
  analistaResponsavel: string
  memorial: string
  dataRecebimento: string
  numeroRevisao: string
  descricao: string
  tipoRelatorio: string
}

const montarDadosObra = (data: FormData) => {
  const classificacao =
    CLASSIFICACOES.find((item) => item.value === data.ocupacao)?.label ?? data.ocupacao

  const tituloPartes = [data.cliente, data.rodovia, data.nomeConcessionaria].filter(Boolean)
  const titulo =
    tituloPartes.length > 0 ? tituloPartes.join(' - ') : 'Nova solicitação'

  const localizacaoPartes = [data.rodovia, data.kilometragem, data.municipioEstado].filter(Boolean)
  const localizacao =
    localizacaoPartes.length > 0 ? localizacaoPartes.join(' | ') : 'Não informado'

  const descricaoInformada = data.descricao.trim()
  const descricaoPartes = [
    data.cliente && `Cliente: ${data.cliente}`,
    data.rodovia && `Rodovia: ${data.rodovia}`,
    data.kilometragem && `Kilometragem: ${data.kilometragem}`,
    classificacao && `Classificação: ${classificacao}`,
    data.ocupacaoArea && `Porte: ${data.ocupacaoArea}`,
    data.nomeConcessionaria && `Concessionária: ${data.nomeConcessionaria}`,
    data.faseProjeto && `Fase: ${data.faseProjeto}`,
    data.numeroRevisao && `Revisão: ${data.numeroRevisao}`,
  ].filter(Boolean)
  const descricaoDerivada =
    descricaoPartes.length > 0
      ? descricaoPartes.join('\n')
      : 'Solicitação registrada a partir do overview do cliente.'

  return {
    titulo,
    tipoObra: data.ocupacao || 'nao_informado',
    localizacao,
    descricao: descricaoInformada || descricaoDerivada,
  }
}

export default function NovaSolicitacao() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<FormData>({
    cliente: '',
    kilometragem: '',
    nroProcessoErp: '',
    rodovia: '',
    nomeConcessionaria: '',
    sentido: '',
    ocupacao: '',
    municipioEstado: '',
    ocupacaoArea: '',
    responsavelTecnico: '',
    faseProjeto: '',
    analistaResponsavel: '',
    memorial: '',
    dataRecebimento: '',
    numeroRevisao: '',
    descricao: '',
    tipoRelatorio: '',
  })
  const [concessionarias, setConcessionarias] = useState<string[]>(() => loadConcessionarias())
  const [novaConcessionaria, setNovaConcessionaria] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portesDisponiveis = PORTES_POR_CLASSIFICACAO[formData.ocupacao] ?? []

  useEffect(() => {
    if (typeof window === 'undefined') return
    saveConcessionarias(concessionarias)
  }, [concessionarias])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      if (name === 'ocupacao') {
        return {
          ...prev,
          ocupacao: value,
          ocupacaoArea: '',
        }
      }

      return {
        ...prev,
        [name]: value
      }
    })
  }

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const validFiles = Array.from(selectedFiles).filter(file => {
      const maxSize = 50 * 1024 * 1024 // 50MB
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      
      if (file.size > maxSize) {
        alert(`O arquivo ${file.name} excede o tamanho máximo de 50MB`)
        return false
      }
      
      if (!validTypes.includes(file.type)) {
        alert(`O arquivo ${file.name} não é um tipo válido (PDF, JPG, PNG, XLSX)`)
        return false
      }
      
      return true
    })

    setFiles(prev => [...prev, ...validFiles])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const obra = montarDadosObra(formData)
      const id = await createSolicitacao(
        {
          titulo: obra.titulo,
          tipoObra: obra.tipoObra,
          localizacao: obra.localizacao,
          descricao: obra.descricao,
          status: 'pendente',
          cliente: formData.cliente || undefined,
          kilometragem: formData.kilometragem || undefined,
          nroProcessoErp: formData.nroProcessoErp || undefined,
          rodovia: formData.rodovia || undefined,
          nomeConcessionaria: formData.nomeConcessionaria || undefined,
          sentido: formData.sentido || undefined,
          ocupacao: formData.ocupacao || undefined,
          municipioEstado: formData.municipioEstado || undefined,
          ocupacaoArea: formData.ocupacaoArea || undefined,
          responsavelTecnico: formData.responsavelTecnico || undefined,
          faseProjeto: formData.faseProjeto || undefined,
          analistaResponsavel: formData.analistaResponsavel || undefined,
          memorial: formData.memorial || undefined,
          dataRecebimento: formData.dataRecebimento || undefined,
          numeroRevisao: formData.numeroRevisao || undefined,
          tipoRelatorio: (formData.tipoRelatorio || undefined) as any,
        },
        files
      )
      navigate('/solicitacao-registrada', {
        state: { solicitacaoId: id, titulo: obra.titulo },
      })
    } catch (err: any) {
      console.error('Erro ao criar solicitação:', err)
      setError(err.message || 'Erro ao criar solicitação. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/solicitacoes')
  }

  const handleAddConcessionaria = () => {
    const resultado = addConcessionaria(concessionarias, novaConcessionaria)
    if (!resultado.nome) return

    setConcessionarias(resultado.concessionarias)
    setFormData((prev) => ({
      ...prev,
      nomeConcessionaria: resultado.nome,
    }))
    setNovaConcessionaria('')
  }

  const handleNovaConcessionariaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleAddConcessionaria()
  }

  return (
    <div className="nova-solicitacao-container">
      <form onSubmit={handleSubmit} className="nova-solicitacao-form">
        {/* Seção Overview Dados do cliente */}
        <div className="form-section">
          <h2 className="section-title">Overview Dados do cliente</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cliente">Cliente</label>
              <input
                type="text"
                id="cliente"
                name="cliente"
                value={formData.cliente}
                onChange={handleInputChange}
                placeholder="Ex: OHR TELECOM EIRELI"
              />
            </div>
            <div className="form-group">
              <label htmlFor="kilometragem">Kilometragem</label>
              <input
                type="text"
                id="kilometragem"
                name="kilometragem"
                value={formData.kilometragem}
                onChange={handleInputChange}
                placeholder="Ex: km 23+880 a km 68+503"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rodovia">Rodovia</label>
              <input
                type="text"
                id="rodovia"
                name="rodovia"
                value={formData.rodovia}
                onChange={handleInputChange}
                placeholder="Ex: BR-277"
              />
            </div>
            <div className="form-group">
              <label htmlFor="numeroRevisao">Número da Revisão</label>
              <input
                type="text"
                id="numeroRevisao"
                name="numeroRevisao"
                value={formData.numeroRevisao}
                onChange={handleInputChange}
                placeholder="Ex: R00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nomeConcessionaria">Nome Concessionária</label>
              <select
                id="nomeConcessionaria"
                name="nomeConcessionaria"
                value={formData.nomeConcessionaria}
                onChange={handleInputChange}
              >
                <option value="">Selecione...</option>
                {concessionarias.map((concessionaria) => (
                  <option key={concessionaria} value={concessionaria}>
                    {concessionaria}
                  </option>
                ))}
              </select>
              <div className="add-concessionaria-row">
                <input
                  type="text"
                  value={novaConcessionaria}
                  onChange={(e) => setNovaConcessionaria(e.target.value)}
                  onKeyDown={handleNovaConcessionariaKeyDown}
                  placeholder="Cadastrar nova concessionária"
                />
                <button
                  type="button"
                  className="btn-add-concessionaria"
                  onClick={handleAddConcessionaria}
                >
                  Adicionar
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="sentido">Sentido</label>
              <input
                type="text"
                id="sentido"
                name="sentido"
                value={formData.sentido}
                onChange={handleInputChange}
                placeholder="Ex: C/D"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ocupacao">Classificação</label>
              <select
                id="ocupacao"
                name="ocupacao"
                value={formData.ocupacao}
                onChange={handleInputChange}
              >
                <option value="">Selecione...</option>
                {CLASSIFICACOES.map((classificacao) => (
                  <option key={classificacao.value} value={classificacao.value}>
                    {classificacao.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ocupacaoArea">Porte</label>
              <select
                id="ocupacaoArea"
                name="ocupacaoArea"
                value={formData.ocupacaoArea}
                onChange={handleInputChange}
                disabled={!formData.ocupacao}
              >
                <option value="">
                  {formData.ocupacao ? 'Selecione...' : 'Selecione a classificação primeiro'}
                </option>
                {portesDisponiveis.map((porte) => (
                  <option key={porte} value={porte}>
                    {porte}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="municipioEstado">Município - Estado</label>
              <input
                type="text"
                id="municipioEstado"
                name="municipioEstado"
                value={formData.municipioEstado}
                onChange={handleInputChange}
                placeholder="Ex: Curitiba - PR"
              />
            </div>
            <div className="form-group">
              <label htmlFor="responsavelTecnico">Responsável Técnico</label>
              <input
                type="text"
                id="responsavelTecnico"
                name="responsavelTecnico"
                value={formData.responsavelTecnico}
                onChange={handleInputChange}
                placeholder="Ex: Rerond Goulart Carvalho"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="faseProjeto">Fase do Projeto</label>
              <select
                id="faseProjeto"
                name="faseProjeto"
                value={formData.faseProjeto}
                onChange={handleInputChange}
              >
                <option value="">Selecione...</option>
                <option value="Executivo">Executivo</option>
                <option value="Viabilidade">Viabilidade</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="analistaResponsavel">Analista Responsável</label>
              <input
                type="text"
                id="analistaResponsavel"
                name="analistaResponsavel"
                value={formData.analistaResponsavel}
                onChange={handleInputChange}
                placeholder="Ex: andreia_admin"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipoRelatorio">Tipo de Projeto Normativo</label>
              <select
                id="tipoRelatorio"
                name="tipoRelatorio"
                value={formData.tipoRelatorio}
                onChange={handleInputChange}
              >
                {TIPOS_PROJETO_NORMATIVO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nroProcessoErp">Nro Processo ERP</label>
              <input
                type="text"
                id="nroProcessoErp"
                name="nroProcessoErp"
                value={formData.nroProcessoErp}
                onChange={handleInputChange}
                placeholder="Ex: ERP-2025-001"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="memorial">Memorial</label>
              <select
                id="memorial"
                name="memorial"
                value={formData.memorial}
                onChange={handleInputChange}
              >
                <option value="">Selecione...</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="dataRecebimento">Data de Recebimento</label>
              <input
                type="date"
                id="dataRecebimento"
                name="dataRecebimento"
                value={formData.dataRecebimento}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Seção Documentos e Imagens */}
        <div className="form-section">
          <h2 className="section-title">Documentos e Imagens</h2>
          
          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="upload-icon" />
            <p className="upload-text">Arraste arquivos aqui ou clique para selecionar</p>
            <p className="upload-info">PDF, JPG, PNG, XLSX (máx. 50MB por arquivo)</p>
            <button
              type="button"
              className="select-files-button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Selecionar Arquivos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>

          {files.length > 0 && (
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    className="remove-file-button"
                    onClick={() => handleRemoveFile(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="descricao">Descrição</label>
            <textarea
              id="descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleInputChange}
              placeholder="Descreva o escopo da obra e os principais elementos do projeto..."
              rows={5}
            />
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-cancelar"
            onClick={handleCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-criar"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Criar Solicitação'}
          </button>
        </div>
      </form>
    </div>
  )
}
