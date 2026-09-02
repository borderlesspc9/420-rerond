import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ImagePlus, Plus, Trash2 } from 'lucide-react'
import {
  EMPTY_DRAFT,
  MODELOS_RELATORIO_PADRAO,
  applyModeloPadraoToDraft,
  getModeloPadraoById,
  slugifyConcessionariaNome,
} from '../config/modelosRelatorioPadrao'
import { FONTES_NORMATIVAS } from '../config/normasCatalogo'
import { TIPOS_DOCUMENTO_OPTIONS } from '../config/tiposDocumento'
import type { ConcessionariaPerfilDraft } from '../models/ConcessionariaPerfil'
import { WIZARD_STEPS, type WizardStepId } from '../models/ConcessionariaPerfil'
import { saveConcessionariaPerfil } from '../services/concessionaria/concessionariaService'
import { uploadLogoConcessionaria } from '../services/relatorio/relatorioConformidadeService'
import type { ConcessionariaWizardLocationState } from '../utils/concessionariaNavigation'
import './NovaConcessionaria.css'

const STEP_ORDER = WIZARD_STEPS.map((step) => step.id)

export default function NovaConcessionaria() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnState = (location.state ?? {}) as ConcessionariaWizardLocationState
  const returnTo = returnState.returnTo?.trim() || null
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [currentStep, setCurrentStep] = useState<WizardStepId>('dados')
  const [draft, setDraft] = useState<ConcessionariaPerfilDraft>({ ...EMPTY_DRAFT })
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  const generatedId = useMemo(
    () => slugifyConcessionariaNome(draft.nome),
    [draft.nome],
  )

  const updateDraft = (patch: Partial<ConcessionariaPerfilDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError(null)
    setSuccess(null)
  }

  const validateStep = (step: WizardStepId): string | null => {
    switch (step) {
      case 'dados':
        if (!draft.nome.trim()) return 'Informe o nome da concessionária.'
        if (!generatedId) return 'Nome inválido para gerar o identificador.'
        return null
      case 'normas':
        if (draft.normasFontes.length === 0) {
          return 'Selecione ao menos uma fonte normativa.'
        }
        return null
      case 'modelo':
        return null
      case 'documentos':
        return null
      case 'checklist':
        if (draft.requisitos.length === 0) {
          return 'Adicione ao menos uma regra de checklist ou selecione um modelo padrão.'
        }
        return null
      case 'logo':
        return null
      case 'revisao':
        return null
      default:
        return null
    }
  }

  const goNext = () => {
    const validationError = validateStep(currentStep)
    if (validationError) {
      setError(validationError)
      return
    }
    const next = STEP_ORDER[currentStepIndex + 1]
    if (next) setCurrentStep(next)
  }

  const goBack = () => {
    const prev = STEP_ORDER[currentStepIndex - 1]
    if (prev) setCurrentStep(prev)
  }

  const handleSelectTemplate = (templateId: string | null) => {
    setSelectedTemplateId(templateId)
    if (!templateId) {
      updateDraft({
        templateId: null,
        modeloRelatorio: { ...EMPTY_DRAFT.modeloRelatorio },
      })
      return
    }

    const template = getModeloPadraoById(templateId)
    if (!template) return

    const applied = applyModeloPadraoToDraft(template, draft.nome.trim() || template.nome)
    updateDraft(applied)
  }

  const toggleNorma = (normaId: string) => {
    const exists = draft.normasFontes.includes(normaId)
    updateDraft({
      normasFontes: exists
        ? draft.normasFontes.filter((item) => item !== normaId)
        : [...draft.normasFontes, normaId],
    })
  }

  const toggleDocumento = (docId: ConcessionariaPerfilDraft['documentosObrigatorios'][number]) => {
    const exists = draft.documentosObrigatorios.includes(docId)
    updateDraft({
      documentosObrigatorios: exists
        ? draft.documentosObrigatorios.filter((item) => item !== docId)
        : [...draft.documentosObrigatorios, docId],
    })
  }

  const addRequisito = () => {
    const index = draft.requisitos.length + 1
    updateDraft({
      requisitos: [
        ...draft.requisitos,
        {
          id: `REQ_${index}`,
          descricao: '',
          categoria: 'ORGANIZACAO',
        },
      ],
    })
  }

  const updateRequisito = (
    index: number,
    patch: Partial<ConcessionariaPerfilDraft['requisitos'][number]>,
  ) => {
    updateDraft({
      requisitos: draft.requisitos.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    })
  }

  const removeRequisito = (index: number) => {
    updateDraft({
      requisitos: draft.requisitos.filter((_, i) => i !== index),
    })
  }

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setLogoFile(file)
    if (!file) {
      setLogoPreview(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(String(reader.result))
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    const validationError = validateStep('dados') ?? validateStep('normas') ?? validateStep('checklist')
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      let logo: { dataUrl?: string | null; url?: string | null } | null = null
      if (logoFile) {
        logo = await uploadLogoConcessionaria(logoFile, draft.nome)
      }

      const saved = await saveConcessionariaPerfil(
        {
          ...draft,
          logoUrl: logo?.url ?? draft.logoUrl ?? null,
          logoDataUrl: logo?.dataUrl ?? draft.logoDataUrl ?? null,
        },
        { id: generatedId, perfilCompleto: true },
      )

      setSuccess(
        `Perfil "${saved.nome}" cadastrado com sucesso. A IA passará a usar este perfil nas análises.`,
      )

      if (returnTo) {
        navigate(returnTo, {
          replace: true,
          state: { concessionariaId: saved.id },
        })
        return
      }

      setTimeout(() => {
        navigate('/dashboard')
      }, 1800)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar concessionária.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'dados':
        return (
          <>
            <h2>Dados da concessionária</h2>
            <p>Informe o nome e identificação. Este será o primeiro passo do perfil usado pela IA.</p>
            <div className="concessionaria-wizard-field">
              <label htmlFor="nome-concessionaria">Nome da concessionária</label>
              <input
                id="nome-concessionaria"
                value={draft.nome}
                onChange={(e) => updateDraft({ nome: e.target.value })}
                placeholder="Ex: Ecovias Rio Minas"
              />
            </div>
            <div className="concessionaria-wizard-field">
              <label htmlFor="rodovia">Rodovia principal (opcional)</label>
              <input
                id="rodovia"
                value={draft.rodovia ?? ''}
                onChange={(e) => updateDraft({ rodovia: e.target.value })}
                placeholder="Ex: BR-116"
              />
            </div>
            <div className="concessionaria-wizard-field">
              <label htmlFor="aliases">Aliases (separados por vírgula)</label>
              <input
                id="aliases"
                value={draft.aliases.join(', ')}
                onChange={(e) =>
                  updateDraft({
                    aliases: e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Ex: ecovias rio minas, erm"
              />
            </div>
            <div className="concessionaria-wizard-field">
              <label htmlFor="tipo-projeto">Tipo de projeto padrão</label>
              <select
                id="tipo-projeto"
                value={draft.tipoProjetoPadrao}
                onChange={(e) =>
                  updateDraft({
                    tipoProjetoPadrao: e.target.value as ConcessionariaPerfilDraft['tipoProjetoPadrao'],
                  })
                }
              >
                <option value="pit">PIT — Projeto de Interesse de Terceiros</option>
                <option value="obra_per">Obra prevista no PER</option>
                <option value="obra_nao_per">Obra não prevista no PER</option>
              </select>
            </div>
            {generatedId && (
              <p className="concessionaria-wizard-skip-hint">
                Identificador gerado: <strong>{generatedId}</strong>
              </p>
            )}
          </>
        )

      case 'normas':
        return (
          <>
            <h2>Normas aplicáveis</h2>
            <p>Selecione as fontes normativas que a IA deve considerar neste perfil.</p>
            <div className="concessionaria-wizard-checklist">
              {FONTES_NORMATIVAS.map((fonte) => (
                <label key={fonte.id} className="concessionaria-wizard-check-item">
                  <input
                    type="checkbox"
                    checked={draft.normasFontes.includes(fonte.id)}
                    onChange={() => toggleNorma(fonte.id)}
                  />
                  <div>
                    <strong>{fonte.titulo}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{fonte.descricao}</div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )

      case 'modelo':
        return (
          <>
            <h2>Modelo de relatório</h2>
            <p>
              Selecione um modelo pré-preenchido <strong>apenas se necessário</strong>. Se a
              concessionária não utiliza esse tipo de documentação, pule esta etapa.
            </p>
            <div className="concessionaria-wizard-templates">
              <button
                type="button"
                className={`concessionaria-wizard-template ${selectedTemplateId === null ? 'selected' : ''}`}
                onClick={() => handleSelectTemplate(null)}
              >
                <h3>Sem modelo padrão</h3>
                <p>Configurar manualmente nas próximas etapas.</p>
              </button>
              {MODELOS_RELATORIO_PADRAO.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`concessionaria-wizard-template ${selectedTemplateId === template.id ? 'selected' : ''}`}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  {template.grupo === 'ecovias' && (
                    <span className="concessionaria-wizard-template-badge">Ecovias</span>
                  )}
                  <h3>{template.nome}</h3>
                  <p>{template.descricao}</p>
                </button>
              ))}
            </div>
            <div className="concessionaria-wizard-field">
              <label htmlFor="titulo-relatorio">Título padrão do relatório</label>
              <input
                id="titulo-relatorio"
                value={draft.modeloRelatorio.tituloPadrao}
                onChange={(e) =>
                  updateDraft({
                    modeloRelatorio: {
                      ...draft.modeloRelatorio,
                      tituloPadrao: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="concessionaria-wizard-field">
              <label htmlFor="template-markdown">Estrutura do relatório (Markdown)</label>
              <textarea
                id="template-markdown"
                value={draft.modeloRelatorio.templateMarkdown}
                onChange={(e) =>
                  updateDraft({
                    modeloRelatorio: {
                      ...draft.modeloRelatorio,
                      templateMarkdown: e.target.value,
                    },
                  })
                }
                placeholder="Seções do parecer técnico..."
              />
            </div>
          </>
        )

      case 'documentos':
        return (
          <>
            <h2>Documentos obrigatórios</h2>
            <p>Marque os tipos de documento exigidos para solicitações desta concessionária.</p>
            <div className="concessionaria-wizard-checklist">
              {TIPOS_DOCUMENTO_OPTIONS.filter((item) => item.value !== 'desconhecido').map(
                (doc) => (
                  <label key={doc.value} className="concessionaria-wizard-check-item">
                    <input
                      type="checkbox"
                      checked={draft.documentosObrigatorios.includes(doc.value)}
                      onChange={() => toggleDocumento(doc.value)}
                    />
                    <span>{doc.label}</span>
                  </label>
                ),
              )}
            </div>
            {draft.documentosObrigatorios.length === 0 && (
              <p className="concessionaria-wizard-skip-hint">
                Nenhum documento selecionado — você pode avançar e configurar depois.
              </p>
            )}
          </>
        )

      case 'checklist':
        return (
          <>
            <h2>Regras e checklist</h2>
            <p>Defina os requisitos de conformidade que a IA deve verificar.</p>
            <button type="button" className="concessionaria-wizard-btn concessionaria-wizard-btn-add" onClick={addRequisito}>
              <Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Adicionar regra
            </button>
            {draft.requisitos.map((req, index) => (
              <div key={`${req.id}-${index}`} className="concessionaria-wizard-requisito">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <label>
                    ID
                    <input
                      value={req.id}
                      onChange={(e) => updateRequisito(index, { id: e.target.value })}
                    />
                  </label>
                  <label>
                    Categoria
                    <input
                      value={req.categoria ?? ''}
                      onChange={(e) => updateRequisito(index, { categoria: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="concessionaria-wizard-btn concessionaria-wizard-btn-secondary"
                    onClick={() => removeRequisito(index)}
                    aria-label="Remover regra"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <label>
                  Descrição
                  <textarea
                    value={req.descricao}
                    onChange={(e) => updateRequisito(index, { descricao: e.target.value })}
                  />
                </label>
              </div>
            ))}
          </>
        )

      case 'logo':
        return (
          <>
            <h2>Logo da concessionária</h2>
            <p>A logo será usada nos relatórios de conformidade gerados para esta concessionária.</p>
            <div className="concessionaria-wizard-logo-row">
              <div className="concessionaria-wizard-logo-preview">
                {logoPreview ? (
                  <img src={logoPreview} alt="Pré-visualização da logo" />
                ) : (
                  'Sem logo'
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="concessionaria-wizard-btn concessionaria-wizard-btn-secondary"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <ImagePlus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Selecionar logo
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoChange}
                  hidden
                />
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>PNG ou JPG · máx. 2 MB</p>
              </div>
            </div>
          </>
        )

      case 'revisao':
        return (
          <>
            <h2>Revisão e ativação</h2>
            <p>Confira o perfil antes de ativar. A IA passará a usar estas configurações nas análises.</p>
            <div className="concessionaria-wizard-review">
              <div className="concessionaria-wizard-review-item">
                <strong>Concessionária</strong>
                <span>
                  {draft.nome} ({generatedId})
                  {draft.rodovia ? ` · ${draft.rodovia}` : ''}
                </span>
              </div>
              <div className="concessionaria-wizard-review-item">
                <strong>Normas</strong>
                <span>{draft.normasFontes.length} fonte(s) selecionada(s)</span>
              </div>
              <div className="concessionaria-wizard-review-item">
                <strong>Modelo de relatório</strong>
                <span>
                  {selectedTemplateId
                    ? getModeloPadraoById(selectedTemplateId)?.nome ?? 'Personalizado'
                    : 'Configuração manual'}
                </span>
              </div>
              <div className="concessionaria-wizard-review-item">
                <strong>Documentos obrigatórios</strong>
                <span>{draft.documentosObrigatorios.length} tipo(s)</span>
              </div>
              <div className="concessionaria-wizard-review-item">
                <strong>Regras / checklist</strong>
                <span>{draft.requisitos.length} regra(s)</span>
              </div>
              <div className="concessionaria-wizard-review-item">
                <strong>Perfil de IA</strong>
                <span>{draft.promptProfile}</span>
              </div>
            </div>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className="concessionaria-wizard">
      <div className="concessionaria-wizard-header">
        <h1>Nova Concessionária</h1>
      </div>

      <div className="concessionaria-wizard-steps">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep
          const isDone = index < currentStepIndex
          return (
            <div
              key={step.id}
              className={`concessionaria-wizard-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              <span className="concessionaria-wizard-step-num">
                {isDone ? <Check size={12} /> : index + 1}
              </span>
              {step.label}
            </div>
          )
        })}
      </div>

      {error && <div className="concessionaria-wizard-error">{error}</div>}
      {success && <div className="concessionaria-wizard-success">{success}</div>}

      <div className="concessionaria-wizard-card">{renderStepContent()}</div>

      <div className="concessionaria-wizard-actions">
        <button
          type="button"
          className="concessionaria-wizard-btn concessionaria-wizard-btn-secondary"
          onClick={() =>
            currentStepIndex === 0
              ? navigate(returnTo ?? '/dashboard')
              : goBack()
          }
          disabled={saving}
        >
          {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
        </button>

        {currentStep === 'revisao' ? (
          <button
            type="button"
            className="concessionaria-wizard-btn concessionaria-wizard-btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Cadastrar e ativar perfil'}
          </button>
        ) : (
          <button
            type="button"
            className="concessionaria-wizard-btn concessionaria-wizard-btn-primary"
            onClick={goNext}
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  )
}
