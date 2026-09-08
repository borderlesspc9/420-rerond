import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Filter,
  Sparkles,
} from 'lucide-react'
import type { ChecklistItem, ComplementoChecklistItem, TipoRelatorio } from '../models/Solicitacao'
import {
  STATUS_LABELS,
  enriquecerChecklist,
  getTipoProjetoNome,
  groupItemsByCategoria,
  hasCategoriaGrouping,
  toComplementosPayload,
  type ChecklistItemEnriquecido,
  type StatusFiltro,
} from '../utils/checklistConformidade'
import './ChecklistConformidadeView.css'

interface ChecklistConformidadeViewProps {
  items: ChecklistItem[]
  tipoRelatorio?: TipoRelatorio
  concessionariaId?: string | null
  editavel?: boolean
  complementosIniciais?: Record<string, string>
  gerando?: boolean
  erroGeracao?: string | null
  onGerarRelatorio?: (complementos: ComplementoChecklistItem[]) => void
}

function StatusBadge({ status }: { status: ChecklistItemEnriquecido['status'] }) {
  const className =
    status === 'OK'
      ? 'conformidade-badge conformidade-ok'
      : status === 'NAO_CONFORME'
        ? 'conformidade-badge conformidade-nao-conforme'
        : 'conformidade-badge conformidade-ausente'

  return <span className={className}>{STATUS_LABELS[status]}</span>
}

interface ItemCardProps {
  item: ChecklistItemEnriquecido
  editavel?: boolean
  complemento?: string
  onComplementoChange?: (itemId: string, texto: string) => void
}

function ItemCard({ item, editavel, complemento, onComplementoChange }: ItemCardProps) {
  const statusClass =
    item.status === 'OK'
      ? 'conformidade-card-ok'
      : item.status === 'NAO_CONFORME'
        ? 'conformidade-card-nao'
        : 'conformidade-card-ausente'

  const permiteComplemento = editavel && item.status !== 'OK'

  return (
    <article className={`conformidade-card ${statusClass}`}>
      <header className="conformidade-card-header">
        <div className="conformidade-card-titulo">
          <StatusBadge status={item.status} />
          <h4>{item.label}</h4>
        </div>
        {!item.catalogado && (
          <span className="conformidade-card-extra">Item adicional da análise</span>
        )}
      </header>

      {item.situacaoEncontrada && (
        <div className="conformidade-card-campo">
          <span className="conformidade-card-label">Situação encontrada</span>
          <p>{item.situacaoEncontrada}</p>
        </div>
      )}

      {item.status !== 'OK' && item.exigenciaNormativa && (
        <div className="conformidade-card-campo">
          <span className="conformidade-card-label">Exigência normativa</span>
          <p>{item.exigenciaNormativa}</p>
        </div>
      )}

      {item.fundamentacao && item.fundamentacao !== '—' && (
        <div className="conformidade-card-campo">
          <span className="conformidade-card-label">Fundamentação</span>
          <p>{item.fundamentacao}</p>
        </div>
      )}

      {item.orientacao && item.status !== 'OK' && !permiteComplemento && (
        <div className="conformidade-card-orientacao">
          <span className="conformidade-card-label">
            {item.status === 'INFORMACAO_AUSENTE' ? 'O que apresentar' : 'Orientação'}
          </span>
          <p>{item.orientacao}</p>
        </div>
      )}

      {permiteComplemento && (
        <div className="conformidade-complemento">
          <label htmlFor={`complemento-${item.item}`} className="conformidade-card-label">
            {item.status === 'INFORMACAO_AUSENTE'
              ? 'Informe o que está faltando'
              : 'Informe a correção ou complemento'}
          </label>
          <textarea
            id={`complemento-${item.item}`}
            className="conformidade-complemento-input"
            rows={3}
            placeholder={
              item.status === 'INFORMACAO_AUSENTE'
                ? 'Ex.: Documento apresentado em anexo, data de emissão, responsável técnico...'
                : 'Ex.: Ajuste realizado conforme Art. X, nova versão do memorial...'
            }
            value={complemento ?? ''}
            onChange={(e) => onComplementoChange?.(item.item, e.target.value)}
          />
        </div>
      )}
    </article>
  )
}

export default function ChecklistConformidadeView({
  items,
  tipoRelatorio,
  concessionariaId,
  editavel = false,
  complementosIniciais = {},
  gerando = false,
  erroGeracao = null,
  onGerarRelatorio,
}: ChecklistConformidadeViewProps) {
  const [filtro, setFiltro] = useState<StatusFiltro>('todos')
  const [conformesAbertos, setConformesAbertos] = useState(false)
  const [complementos, setComplementos] = useState<Record<string, string>>(complementosIniciais)

  useEffect(() => {
    setComplementos(complementosIniciais)
  }, [complementosIniciais])

  const enriquecidos = useMemo(
    () => enriquecerChecklist(items, tipoRelatorio, concessionariaId),
    [items, tipoRelatorio, concessionariaId],
  )

  const usarAgrupamentoCategoria =
    filtro === 'todos' && hasCategoriaGrouping(enriquecidos)
  const gruposCategoria = usarAgrupamentoCategoria
    ? groupItemsByCategoria(enriquecidos)
    : []

  const okItems = enriquecidos.filter((i) => i.status === 'OK')
  const naoConformeItems = enriquecidos.filter((i) => i.status === 'NAO_CONFORME')
  const ausenteItems = enriquecidos.filter((i) => i.status === 'INFORMACAO_AUSENTE')
  const itensEditaveis = enriquecidos.filter((i) => i.status !== 'OK')

  const itensFiltrados =
    filtro === 'todos' ? enriquecidos : enriquecidos.filter((i) => i.status === filtro)

  const tipoNome = getTipoProjetoNome(tipoRelatorio)
  const totalCatalogo = tipoRelatorio
    ? enriquecidos.filter((i) => i.catalogado).length
    : enriquecidos.length

  const complementosPreenchidos = toComplementosPayload(complementos)
  const podeGerar = editavel && complementosPreenchidos.length > 0 && !gerando

  const handleComplementoChange = (itemId: string, texto: string) => {
    setComplementos((prev) => {
      const next = { ...prev, [itemId]: texto }
      if (!texto.trim()) delete next[itemId]
      return next
    })
  }

  const renderCard = (item: ChecklistItemEnriquecido) => (
    <ItemCard
      key={item.item}
      item={item}
      editavel={editavel}
      complemento={complementos[item.item]}
      onComplementoChange={handleComplementoChange}
    />
  )

  return (
    <div className="conformidade-view">
      {tipoNome && (
        <div className="conformidade-contexto">
          <span className="conformidade-contexto-label">Tipo normativo</span>
          <strong>{tipoNome}</strong>
          <span className="conformidade-contexto-meta">
            {totalCatalogo} requisitos no catálogo do aplicativo
          </span>
        </div>
      )}

      {editavel && itensEditaveis.length > 0 && (
        <div className="conformidade-complemento-banner">
          <Sparkles size={18} />
          <div>
            <strong>Complementar análise</strong>
            <p>
              Preencha os campos nos itens pendentes ou não conformes. A IA regenera o checklist e
              o parecer técnico completo com base no que você informar. Isso é edição/complemento
              desta solicitação — não cria feedback permanente nem treina a IA.
            </p>
          </div>
        </div>
      )}

      <div className="conformidade-summary">
        <button
          type="button"
          className={`conformidade-stat ${filtro === 'todos' ? 'conformidade-stat-active' : ''}`}
          onClick={() => setFiltro('todos')}
        >
          <span className="conformidade-stat-number">{enriquecidos.length}</span>
          <span className="conformidade-stat-label">Total</span>
        </button>
        <button
          type="button"
          className={`conformidade-stat conformidade-stat-ok ${filtro === 'OK' ? 'conformidade-stat-active' : ''}`}
          onClick={() => setFiltro('OK')}
        >
          <span className="conformidade-stat-number">{okItems.length}</span>
          <span className="conformidade-stat-label">Conformes</span>
        </button>
        <button
          type="button"
          className={`conformidade-stat conformidade-stat-nao ${filtro === 'NAO_CONFORME' ? 'conformidade-stat-active' : ''}`}
          onClick={() => setFiltro('NAO_CONFORME')}
        >
          <span className="conformidade-stat-number">{naoConformeItems.length}</span>
          <span className="conformidade-stat-label">Não conformes</span>
        </button>
        <button
          type="button"
          className={`conformidade-stat conformidade-stat-ausente ${filtro === 'INFORMACAO_AUSENTE' ? 'conformidade-stat-active' : ''}`}
          onClick={() => setFiltro('INFORMACAO_AUSENTE')}
        >
          <span className="conformidade-stat-number">{ausenteItems.length}</span>
          <span className="conformidade-stat-label">Doc. pendente</span>
        </button>
      </div>

      {filtro !== 'todos' && (
        <div className="conformidade-filtro-ativo">
          <Filter size={14} />
          Exibindo: {STATUS_LABELS[filtro]}
          <button type="button" onClick={() => setFiltro('todos')}>
            Limpar filtro
          </button>
        </div>
      )}

      {filtro === 'todos' && usarAgrupamentoCategoria ? (
        <>
          {gruposCategoria.map((grupo) => (
            <section key={grupo.categoria} className="conformidade-secao">
              <header className="conformidade-secao-header">
                <div>
                  <h3>{grupo.label}</h3>
                  <p>{grupo.items.length} item(ns) nesta categoria</p>
                </div>
              </header>
              <div className="conformidade-cards">
                {grupo.items.map(renderCard)}
              </div>
            </section>
          ))}
        </>
      ) : filtro === 'todos' ? (
        <>
          {ausenteItems.length > 0 && (
            <section className="conformidade-secao conformidade-secao-pendente">
              <header className="conformidade-secao-header">
                <FileWarning size={18} />
                <div>
                  <h3>Documentação pendente</h3>
                  <p>
                    {ausenteItems.length} requisito(s) sem informação suficiente. Informe o que
                    falta nos campos abaixo.
                  </p>
                </div>
              </header>
              <div className="conformidade-cards">
                {ausenteItems.map(renderCard)}
              </div>
            </section>
          )}

          {naoConformeItems.length > 0 && (
            <section className="conformidade-secao conformidade-secao-nao">
              <header className="conformidade-secao-header">
                <AlertTriangle size={18} />
                <div>
                  <h3>Não conformidades</h3>
                  <p>
                    {naoConformeItems.length} requisito(s) em desacordo. Informe correções nos
                    campos abaixo.
                  </p>
                </div>
              </header>
              <div className="conformidade-cards">
                {naoConformeItems.map(renderCard)}
              </div>
            </section>
          )}

          {okItems.length > 0 && (
            <section className="conformidade-secao conformidade-secao-ok">
              <button
                type="button"
                className="conformidade-secao-toggle"
                onClick={() => setConformesAbertos((v) => !v)}
              >
                <header className="conformidade-secao-header">
                  <CheckCircle2 size={18} />
                  <div>
                    <h3>Itens conformes</h3>
                    <p>{okItems.length} requisito(s) atendidos conforme a norma.</p>
                  </div>
                </header>
                {conformesAbertos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {conformesAbertos && (
                <div className="conformidade-cards conformidade-cards-compact">
                  {okItems.map(renderCard)}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="conformidade-cards">
          {itensFiltrados.map(renderCard)}
        </div>
      )}

      {itensFiltrados.length === 0 && (
        <p className="conformidade-vazio">Nenhum item neste filtro.</p>
      )}

      {editavel && onGerarRelatorio && (
        <div className="conformidade-gerar-panel">
          <div className="conformidade-gerar-info">
            <span>
              {complementosPreenchidos.length} complemento(s) preenchido(s)
            </span>
            {erroGeracao && <p className="conformidade-gerar-erro">{erroGeracao}</p>}
          </div>
          <button
            type="button"
            className="conformidade-gerar-btn"
            disabled={!podeGerar}
            onClick={() => onGerarRelatorio(complementosPreenchidos)}
          >
            <Sparkles size={16} />
            {gerando ? 'Gerando relatório...' : 'Gerar relatório completo com IA'}
          </button>
        </div>
      )}
    </div>
  )
}
