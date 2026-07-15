import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react'

// ── Types ──

export type InputSize = 'sm' | 'md'

export type InputFocusColor = 'purple' | 'red'

type InputOwnProps = {
  /** `sm` = rounded-xl px-3 py-2.5 (campaign forms), `md` = rounded-2xl px-4 py-3 (admin/checkout) */
  size?: InputSize
  /** Focus border colour */
  focusColor?: InputFocusColor
  /** Render as `<textarea>` instead of `<input>` */
  multiline?: boolean
  /** Error message — shows a red border and message below the input */
  error?: string
  /** Optional label rendered above the input */
  label?: string
  className?: string
}

type InputAsInput = InputOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { multiline?: false }

type InputAsTextarea = InputOwnProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true }

export type InputProps = InputAsInput | InputAsTextarea

// ── Style maps ──

const sizeStyles: Record<InputSize, string> = {
  sm: 'rounded-xl px-3 py-2.5',
  md: 'rounded-2xl px-4 py-3',
}

const focusStyles: Record<InputFocusColor, string> = {
  purple: 'focus:border-[var(--shop-purple)]',
  red: 'focus:border-[var(--shop-red)]',
}

function getBorderStyle(error: string | undefined): string {
  return error
    ? 'border-[var(--shop-red)]/60'
    : 'border-white/10'
}

// ── Component ──

export const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(function Input(
  {
    size = 'md',
    focusColor = 'purple',
    multiline = false,
    error,
    label,
    className = '',
    id: idProp,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const errorId = error ? `${inputId}-error` : undefined

  const inputClasses = [
    // Base
    'w-full border bg-white/8 text-sm text-[var(--shop-cream)] outline-none transition-colors',
    'placeholder:text-[var(--shop-muted)]/70',
    // Size
    sizeStyles[size],
    // Focus
    focusStyles[focusColor],
    // Border (error vs normal)
    getBorderStyle(error),
    // Custom
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Wrap in a div for the label + error layout
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]"
        >
          {label}
        </label>
      )}

      {multiline ? (
        <textarea
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={errorId}
          className={`${inputClasses} min-h-24 resize-y leading-6`}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.ForwardedRef<HTMLInputElement>}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={errorId}
          className={inputClasses}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-[11px] font-medium text-[var(--shop-red)]"
        >
          {error}
        </p>
      )}
    </div>
  )
})
