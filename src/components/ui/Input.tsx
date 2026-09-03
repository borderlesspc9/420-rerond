import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './Input.css'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string
  error?: string | null
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    fullWidth = true,
    type = 'text',
    id,
    className = '',
    disabled,
    ...rest
  },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const hasError = Boolean(error)

  return (
    <div
      className={[
        'ui-field',
        fullWidth ? 'ui-field--full' : '',
        hasError ? 'ui-field--error' : '',
        disabled ? 'ui-field--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}

      <div className="ui-field__shell">
        {leftIcon && <span className="ui-field__icon ui-field__icon--left">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={[
            'ui-field__input',
            leftIcon ? 'ui-field__input--with-left' : '',
            isPassword || rightIcon ? 'ui-field__input--with-right' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError && inputId
              ? `${inputId}-error`
              : hint && inputId
                ? `${inputId}-hint`
                : undefined
          }
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="ui-field__icon ui-field__icon--right ui-field__toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : (
          rightIcon && <span className="ui-field__icon ui-field__icon--right">{rightIcon}</span>
        )}
      </div>

      {hasError ? (
        <p className="ui-field__error" id={inputId ? `${inputId}-error` : undefined} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ui-field__hint" id={inputId ? `${inputId}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  )
})
