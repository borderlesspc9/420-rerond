import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from 'lucide-react'
import type { ConcessionariaPerfil, TipoProjetoPadrao } from '../models/ConcessionariaPerfil'
import { FONTES_NORMATIVAS } from '../config/normasCatalogo'
import { TIPOS_DOCUMENTO_OPTIONS } from '../config/tiposDocumento'
import { getModeloPadraoById } from '../config/modelosRelatorioPadrao'
import { updateConcessionariaPerfilFields } from '../services/concessionaria/concessionariaService'
import './ConcessionariaPerfilResumo.css'

const TIPO_PROJETO_LABELS: Record<TipoProjetoPadrao, string> = {
  pit: 'PIT — Projeto de Interesse de Terceiros',
  obra_per: 'Obra prevista no PER',
  obra_nao_per: 'Obra não prevista no PER',
}

type ConcessionariaPerfilResumoProps = {
  perfil: ConcessionariaPerfil
  onUpdated: (perfil: ConcessionariaPerfil) => void
  onEditCompleto: () => void
}

export default function ConcessionariaPerfilResumo({
  perfil,
  onUpdated,
  onEditCompleto,
}: ConcessionariaPerfilResumoProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nome, setNome] = useState(perfil.nome)
  const [rodovia, setRodovia] = useState(perfil.rodovia ?? '')
  const [tipoProjetoPadrao, setTipoProjetoPadrao] = useState(perfil.tipoProjetoPadrao)
  const [tituloRelatorio, setTituloRelatorio] = useState(perfil.modeloRelatorio.tituloPadrao)

  const normasLabels = perfil.normasFontes.map((id) => {
    const catalog = FONTES_NORMATIVAS.find((f) => f.id === id)?.titulo
    if (catalog) return catalog
    const custom = (perfil.normasCustom ?? []).find((f) => f.id === id)?.titulo
    return custom ?? id
  })
  const documentosLabels = perfil.documentosObrigatorios.map((id) => {
    const catalog = TIPOS_DOCUMENTO_OPTIONS.find((d) => d.value === id)?.label
    if (catalog) return catalog
    const custom = (perfil.documentosCustom ?? []).find((d) => d.id === id)?.label
    return custom ?? id
  })
  const templateNome = perfil.templateId
    ? getModeloPadraoById(perfil.templateId)?.nome ?? 'Personalizado'
    : 'Configuração manual'

  const logoSrc = perfil.logoDataUrl || perfil.logoUrl

  const handleSaveEdits = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateConcessionariaPerfilFields(perfil.id, {
        nome: nome.trim(),
        rodovia: rodovia.trim(),
        tipoProjetoPadrao,
        modeloRelatorio: { ...perfil.modeloRelatorio, tituloPadrao: tituloRelatorio.trim() },
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setNome(perfil.nome)
    setRodovia(perfil.rodovia ?? '')
    setTipoProjetoPadrao(perfil.tipoProjetoPadrao)
    setTituloRelatorio(perfil.modeloRelatorio.tituloPadrao)
    setEditing(false)
    setError(null)
  }

  return (
    <div className="conc-resumo">
      <button
        type="button"
        className="conc-resumo-header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="conc-resumo-header-main">
          {logoSrc ? (
            <img src={logoSrc} alt="" className="conc-resumo-logo" />
          ) : (
            <span className="conc-resumo-logo-placeholder">{perfil.nome.charAt(0)}</span>
          )}
          <div className="conc-resumo-title-block">
            <span className="conc-resumo-nome">{perfil.nome}</span>
            <span className="conc-resumo-meta">
              {perfil.perfilCompleto ? 'Perfil completo · IA ativa' : 'Perfil incompleto'}
              {perfil.rodovia ? ` · ${perfil.rodovia}` : ''}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {expanded && (
        <div className="conc-resumo-body">
          {error && <p className="conc-resumo-error">{error}</p>}

          {editing ? (
            <div className="conc-resumo-edit">
              <label>
                Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
              <label>
                Rodovia
                <input value={rodovia} onChange={(e) => setRodovia(e.target.value)} />
              </label>
              <label>
                Tipo de projeto padrão
                <select
                  value={tipoProjetoPadrao}
                  onChange={(e) => setTipoProjetoPadrao(e.target.value as TipoProjetoPadrao)}
                >
                  {Object.entries(TIPO_PROJETO_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título padrão do relatório
                <input value={tituloRelatorio} onChange={(e) => setTituloRelatorio(e.target.value)} />
              </label>
              <div className="conc-resumo-edit-actions">
                <button type="button" className="conc-resumo-btn-secondary" onClick={cancelEdit}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="conc-resumo-btn-primary"
                  onClick={() => void handleSaveEdits()}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="conc-resumo-dl">
                <div>
                  <dt>Identificador</dt>
                  <dd>{perfil.id}</dd>
                </div>
                <div>
                  <dt>Tipo de projeto</dt>
                  <dd>{TIPO_PROJETO_LABELS[perfil.tipoProjetoPadrao]}</dd>
                </div>
                <div>
                  <dt>Modelo de relatório</dt>
                  <dd>{templateNome}</dd>
                </div>
                <div>
                  <dt>Título do relatório</dt>
                  <dd>{perfil.modeloRelatorio.tituloPadrao}</dd>
                </div>
                <div>
                  <dt>Normas ({normasLabels.length})</dt>
                  <dd>
                    {normasLabels.length > 0 ? (
                      <ul>
                        {normasLabels.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      'Nenhuma'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Documentos obrigatórios ({documentosLabels.length})</dt>
                  <dd>
                    {documentosLabels.length > 0 ? (
                      <ul>
                        {documentosLabels.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      'Nenhum'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Regras / checklist</dt>
                  <dd>{perfil.requisitos.length} regra(s)</dd>
                </div>
                {perfil.aliases.length > 0 && (
                  <div>
                    <dt>Aliases</dt>
                    <dd>{perfil.aliases.join(', ')}</dd>
                  </div>
                )}
              </dl>

              <div className="conc-resumo-actions">
                <button type="button" className="conc-resumo-btn-secondary" onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                  Editar dados básicos
                </button>
                <button type="button" className="conc-resumo-btn-link" onClick={onEditCompleto}>
                  <ExternalLink size={14} />
                  Editar cadastro completo
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
