import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { createSolicitacao } from '../services/solicitacao/solicitacaoService'
import {
  CONCESSIONARIAS,
  OUTRA_CONCESSIONARIA_VALUE,
  getConcessionariaById,
} from '../config/concessionarias'
import { listConcessionariasPerfil } from '../services/concessionaria/concessionariaService'
import {
  buildConcessionariaOptions,
  findConcessionariaOption,
  type ConcessionariaOption,
} from '../utils/concessionariasOptions'
import {
  addConcessionaria,
  loadConcessionarias,
  saveConcessionarias,
  type ConcessionariaCadastrada,
} from '../utils/concessionariasStorage'
import { uploadLogoConcessionaria } from '../services/relatorio/relatorioConformidadeService'
import { TIPOS_DOCUMENTO_OPTIONS, getFileKey } from '../config/tiposDocumento'
import type { TipoDocumentoAnexo } from '../models/Solicitacao'
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
  interessado: string
  kilometragem: string
  nroProcessoErp: string
  rodovia: string
  nomeConcessionaria: string
  concessionariaId: string
  concessionariaSelect: string
  sentido: string
  ocupacao: string
  municipioEstado: string
  uf: string
  ocupacaoArea: string
  responsavelTecnico: string
  extensao: string
  numeroArt: string
  tipoIntervencaoDetalhado: string
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
  const logoCadastroInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<FormData>({
    cliente: '',
    interessado: '',
    kilometragem: '',
    nroProcessoErp: '',
    rodovia: '',
    nomeConcessionaria: '',
    concessionariaId: '',
    concessionariaSelect: '',
    sentido: '',
    ocupacao: '',
    municipioEstado: '',
    uf: '',
    ocupacaoArea: '',
    responsavelTecnico: '',
    extensao: '',
    numeroArt: '',
    tipoIntervencaoDetalhado: '',
    faseProjeto: '',
    analistaResponsavel: '',
    memorial: '',
    dataRecebimento: '',
    numeroRevisao: '',
    descricao: '',
    tipoRelatorio: '',
  })
  const [concessionarias, setConcessionarias] = useState<ConcessionariaCadastrada[]>(() =>
    loadConcessionarias(),
  )
  const [concessionariaOptions, setConcessionariaOptions] = useState<ConcessionariaOption[]>(() =>
    buildConcessionariaOptions(),
  )
  const [novaConcessionaria, setNovaConcessionaria] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileDocumentTypes, setFileDocumentTypes] = useState<Record<string, TipoDocumentoAnexo>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portesDisponiveis = PORTES_POR_CLASSIFICACAO[formData.ocupacao] ?? []

  useEffect(() => {
    if (typeof window === 'undefined') return
    saveConcessionarias(concessionarias)
  }, [concessionarias])

  useEffect(() => {
    let cancelled = false
    const loadProfiles = async () => {
      try {
        const profiles = await listConcessionariasPerfil()
        if (!cancelled) {
          setConcessionariaOptions(buildConcessionariaOptions(profiles))
        }
      } catch (err) {
        console.error('Erro ao carregar concessionárias do Firestore:', err)
      }
    }
    void loadProfiles()
    return () => {
      cancelled = true
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    if (name === 'concessionariaSelect') {
      const configurada = getConcessionariaById(value)
      if (configurada) {
        setFormData((prev) => ({
          ...prev,
          concessionariaSelect: value,
          concessionariaId: configurada.id,
          nomeConcessionaria: configurada.nome,
          tipoRelatorio: prev.tipoRelatorio || 'pit',
        }))
        return
      }

      const perfilFirestore = findConcessionariaOption(concessionariaOptions, value)
      if (perfilFirestore?.source === 'firestore') {
        setFormData((prev) => ({
          ...prev,
          concessionariaSelect: value,
          concessionariaId: perfilFirestore.id,
          nomeConcessionaria: perfilFirestore.nome,
          tipoRelatorio: prev.tipoRelatorio || 'pit',
        }))
        return
      }

      if (value === OUTRA_CONCESSIONARIA_VALUE) {
        setFormData((prev) => ({
          ...prev,
          concessionariaSelect: value,
          concessionariaId: 'outra',
          nomeConcessionaria: '',
        }))
        return
      }

      setFormData((prev) => ({
        ...prev,
        concessionariaSelect: value,
        concessionariaId: 'outra',
        nomeConcessionaria: value,
      }))
      return
    }

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

  const handleFileDocumentTypeChange = (file: File, tipoDocumento: TipoDocumentoAnexo) => {
    const key = getFileKey(file)
    setFileDocumentTypes((prev) => ({ ...prev, [key]: tipoDocumento }))
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
    validFiles.forEach((file) => {
      const key = getFileKey(file)
      setFileDocumentTypes((prev) => ({ ...prev, [key]: prev[key] ?? 'desconhecido' }))
    })
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
    setFiles(prev => {
      const removed = prev[index]
      if (removed) {
        const key = getFileKey(removed)
        setFileDocumentTypes((types) => {
          const next = { ...types }
          delete next[key]
          return next
        })
      }
      return prev.filter((_, i) => i !== index)
    })
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
          concessionariaId: formData.concessionariaId || null,
          cliente: formData.cliente || undefined,
          interessado: formData.interessado || formData.cliente || undefined,
          kilometragem: formData.kilometragem || undefined,
          nroProcessoErp: formData.nroProcessoErp || undefined,
          rodovia: formData.rodovia || undefined,
          nomeConcessionaria: formData.nomeConcessionaria || undefined,
          sentido: formData.sentido || undefined,
          ocupacao: formData.ocupacao || undefined,
          municipioEstado: formData.municipioEstado || undefined,
          uf: formData.uf || undefined,
          ocupacaoArea: formData.ocupacaoArea || undefined,
          responsavelTecnico: formData.responsavelTecnico || undefined,
          extensao: formData.extensao || undefined,
          numeroArt: formData.numeroArt || undefined,
          tipoIntervencaoDetalhado: formData.tipoIntervencaoDetalhado || undefined,
          faseProjeto: formData.faseProjeto || undefined,
          analistaResponsavel: formData.analistaResponsavel || undefined,
          memorial: formData.memorial || undefined,
          dataRecebimento: formData.dataRecebimento || undefined,
          numeroRevisao: formData.numeroRevisao || undefined,
          tipoRelatorio: (formData.tipoRelatorio || undefined) as any,
        },
        files,
        fileDocumentTypes
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

  const resetLogoCadastro = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (logoCadastroInputRef.current) logoCadastroInputRef.current.value = ''
  }

  const handleLogoCadastroChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setLogoFile(file)
    if (!file) {
      setLogoPreview(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(String(reader.result))
    reader.onerror = () => setLogoPreview(null)
    reader.readAsDataURL(file)
  }

  const handleAddConcessionaria = async () => {
    const nome = novaConcessionaria.trim()
    if (!nome) return

    setUploadingLogo(true)
    setError(null)
    try {
      let logo: { dataUrl?: string | null; url?: string | null } | null = null
      if (logoFile) {
        logo = await uploadLogoConcessionaria(logoFile, nome)
      }

      const resultado = addConcessionaria(concessionarias, nome, logo)
      setConcessionarias(resultado.concessionarias)
      setFormData((prev) => ({
        ...prev,
        concessionariaSelect: resultado.nome,
        concessionariaId: 'outra',
        nomeConcessionaria: resultado.nome,
      }))
      setNovaConcessionaria('')
      resetLogoCadastro()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar concessionária.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleNovaConcessionariaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void handleAddConcessionaria()
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
              <label htmlFor="interessado">Interessado</label>
              <input
                type="text"
                id="interessado"
                name="interessado"
                value={formData.interessado}
                onChange={handleInputChange}
                placeholder="Ex: EDP Espírito Santo Distribuição de Energia S.A."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="kilometragem">Kilometragem</label>
              <input
                type="text"
                id="kilometragem"
                name="kilometragem"
                value={formData.kilometragem}
                onChange={handleInputChange}
                placeholder="Ex: km 123+424"
              />
            </div>
            <div className="form-group">
              <label htmlFor="extensao">Extensão</label>
              <input
                type="text"
                id="extensao"
                name="extensao"
                value={formData.extensao}
                onChange={handleInputChange}
                placeholder="Ex: 145,25 m"
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
              <label htmlFor="concessionariaSelect">Concessionária</label>
              <select
                id="concessionariaSelect"
                name="concessionariaSelect"
                value={formData.concessionariaSelect}
                onChange={handleInputChange}
              >
                <option value="">Selecione...</option>
                {CONCESSIONARIAS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
                {concessionariaOptions
                  .filter((item) => item.source === 'firestore')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                      {item.perfilCompleto ? '' : ' (perfil incompleto)'}
                    </option>
                  ))}
                <option value={OUTRA_CONCESSIONARIA_VALUE}>
                  Outra concessionária / cadastro rápido
                </option>
              </select>
              <p className="add-concessionaria-hint">
                Para configurar normas, modelo de relatório, checklist e logo, use{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/concessionarias/nova')}
                >
                  Nova Concessionária
                </button>
                .
              </p>
              <div className="add-concessionaria-block">
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
                    onClick={() => void handleAddConcessionaria()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>
                <div className="add-concessionaria-logo-row">
                  <div className="add-concessionaria-logo-preview">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Pré-visualização da logo" />
                    ) : (
                      <span>Logo (opcional)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-add-concessionaria-logo"
                    onClick={() => logoCadastroInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    Selecionar logo
                  </button>
                  <input
                    ref={logoCadastroInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleLogoCadastroChange}
                    hidden
                  />
                  {logoFile && (
                    <button
                      type="button"
                      className="btn-clear-concessionaria-logo"
                      onClick={resetLogoCadastro}
                      disabled={uploadingLogo}
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="add-concessionaria-logo-hint">PNG ou JPG · máx. 2 MB</p>
              </div>
            </div>            <div className="form-group">
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
                placeholder="Ex: Sooretama - ES"
              />
            </div>
            <div className="form-group">
              <label htmlFor="uf">UF</label>
              <input
                type="text"
                id="uf"
                name="uf"
                value={formData.uf}
                onChange={handleInputChange}
                placeholder="Ex: ES"
                maxLength={2}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipoIntervencaoDetalhado">Tipo de intervenção detalhado</label>
              <input
                type="text"
                id="tipoIntervencaoDetalhado"
                name="tipoIntervencaoDetalhado"
                value={formData.tipoIntervencaoDetalhado}
                onChange={handleInputChange}
                placeholder="Ex: ocupação de faixa e travessia aérea..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="numeroArt">Número da ART</label>
              <input
                type="text"
                id="numeroArt"
                name="numeroArt"
                value={formData.numeroArt}
                onChange={handleInputChange}
                placeholder="Ex: ART-123456"
              />
            </div>
          </div>

          <div className="form-row">
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
            <div className="form-group" />
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
              {files.map((file, index) => {
                const fileKey = getFileKey(file)
                return (
                  <div key={fileKey} className="file-item">
                    <span className="file-name">{file.name}</span>
                    <select
                      className="file-type-select"
                      value={fileDocumentTypes[fileKey] ?? 'desconhecido'}
                      onChange={(e) =>
                        handleFileDocumentTypeChange(file, e.target.value as TipoDocumentoAnexo)
                      }
                    >
                      {TIPOS_DOCUMENTO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
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
                )
              })}
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
