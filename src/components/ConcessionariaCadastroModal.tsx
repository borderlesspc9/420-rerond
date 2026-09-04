import { Building2, X } from 'lucide-react'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'
import './ConcessionariaCadastroModal.css'

type ConcessionariaCadastroModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ConcessionariaCadastroModal({
  open,
  onClose,
  onConfirm,
}: ConcessionariaCadastroModalProps) {
  const overlayDismiss = useOverlayDismiss(onClose)
  if (!open) return null

  return (
    <div
      className="conc-modal-overlay"
      onMouseDown={overlayDismiss.onMouseDown}
      onClick={overlayDismiss.onClick}
      role="presentation"
    >
      <div
        className="conc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="conc-modal-header">
          <div className="conc-modal-icon">
            <Building2 size={22} />
          </div>
          <button type="button" className="conc-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <h2 id="conc-modal-title">Cadastrar nova concessionária</h2>
        <p className="conc-modal-desc">
          Você será direcionado ao cadastro completo para configurar normas, modelo de relatório,
          documentos obrigatórios, checklist e logo. Ao concluir, retornará automaticamente para
          esta solicitação com a concessionária selecionada.
        </p>

        <div className="conc-modal-actions">
          <button type="button" className="conc-modal-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="conc-modal-btn-primary" onClick={onConfirm}>
            Ir para cadastro
          </button>
        </div>
      </div>
    </div>
  )
}
