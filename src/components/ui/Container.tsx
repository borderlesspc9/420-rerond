import type { HTMLAttributes, ReactNode } from 'react'
import './Container.css'

export type ContainerVariant = 'page' | 'narrow' | 'wide' | 'card' | 'section'
export type ContainerPad = 'none' | 'sm' | 'md' | 'lg'

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  variant?: ContainerVariant
  pad?: ContainerPad
  children: ReactNode
}

export function Container({
  variant = 'page',
  pad = 'md',
  children,
  className = '',
  ...rest
}: ContainerProps) {
  return (
    <div
      className={[
        'ui-container',
        `ui-container--${variant}`,
        `ui-container--pad-${pad}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}
