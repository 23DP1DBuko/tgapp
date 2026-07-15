import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ElementType,
  forwardRef,
} from 'react'

// ── Variant & size types ──

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'ghost'
  | 'success'

export type ButtonSize = 'sm' | 'md' | 'lg'

// ── Props ──

type ButtonOwnProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

type ButtonAsButton = ButtonOwnProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' }

type ButtonAsAnchor = ButtonOwnProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a' }

type ButtonAsOther<E extends ElementType> = ButtonOwnProps & {
  as: E
}

// ── Variant style maps ──

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)]',
  secondary:
    'border border-white/10 bg-white/8 text-[var(--shop-cream)]',
  destructive:
    'bg-[var(--shop-red)] text-white',
  ghost:
    'border border-white/10 bg-white/8 text-[var(--shop-muted)]',
  success:
    'bg-emerald-300/20 text-emerald-100',
}

const disabledVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'disabled:opacity-40 disabled:shadow-none',
  secondary:
    'disabled:opacity-40',
  destructive:
    'disabled:opacity-50',
  ghost:
    'disabled:opacity-40',
  success:
    'disabled:opacity-50',
}

// ── Size style maps ──

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'rounded-xl px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em]',
  md: 'rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-[0.18em]',
  lg: 'rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-[0.2em]',
}

// ── Loading spinner ──

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? 'h-4 w-4'}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Component ──

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonAsButton | ButtonAsAnchor | ButtonAsOther<ElementType>
>(function Button(
  {
    variant = 'primary',
    size = 'lg',
    loading = false,
    fullWidth = false,
    disabled,
    className = '',
    children,
    as,
    ...rest
  },
  ref,
) {
  const Tag = (as ?? 'button') as ElementType
  const isDisabled = disabled || loading

  // Default type="button" so buttons don't accidentally submit forms.
  // The JSX prop type= comes BEFORE {...rest}, so an explicit type from the
  // consumer (e.g. type="submit") will override this default.
  const resolvedType = as === 'a' ? undefined : 'button'

  const classes = [
    // Base
    'inline-flex items-center justify-center gap-2 text-center',
    size === 'sm' ? 'active:scale-95' : 'active:scale-[0.98]',
    'disabled:cursor-not-allowed',
    // Variant
    variantStyles[variant],
    disabledVariantStyles[variant],
    // Size
    sizeStyles[size],
    // Full width
    fullWidth ? 'w-full' : '',
    // Custom
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      disabled={as === 'a' ? undefined : isDisabled}
      aria-disabled={isDisabled || undefined}
      type={resolvedType}
      className={classes}
      {...rest}
    >
      {loading ? <Spinner className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} /> : null}
      {children}
    </Tag>
  )
})
