import { useRef, type MouseEvent } from 'react'

/**
 * Fecha overlay só se o clique começar e terminar no próprio backdrop.
 * Evita fechar ao selecionar texto e soltar o mouse fora do conteúdo.
 */
export function useOverlayDismiss(onClose?: () => void) {
  const pressedOnBackdrop = useRef(false)

  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      pressedOnBackdrop.current = e.target === e.currentTarget
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (!onClose) return
      if (pressedOnBackdrop.current && e.target === e.currentTarget) {
        onClose()
      }
      pressedOnBackdrop.current = false
    },
  }
}
