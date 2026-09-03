import type { HTMLAttributes, ReactNode } from 'react'
import './Typography.css'

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'muted'

type TypographyTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'label'

const VARIANT_TAG: Record<TypographyVariant, TypographyTag> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  subtitle: 'p',
  body: 'p',
  bodyStrong: 'p',
  caption: 'span',
  label: 'label',
  muted: 'p',
}

export type TypographyProps = HTMLAttributes<HTMLElement> & {
  variant?: TypographyVariant
  as?: TypographyTag
  children: ReactNode
}

export function Typography({
  variant = 'body',
  as,
  children,
  className = '',
  ...rest
}: TypographyProps) {
  const Tag = as ?? VARIANT_TAG[variant]

  return (
    <Tag className={['ui-type', `ui-type--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}
