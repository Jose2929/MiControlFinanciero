import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary:
    'brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95 disabled:opacity-60',
  secondary:
    'bg-surface2 text-ink border border-line hover:bg-line/60 active:bg-line disabled:opacity-60',
  ghost: 'text-ink hover:bg-surface2 active:bg-line disabled:opacity-50',
  danger: 'bg-negative text-white hover:brightness-110 active:brightness-95 disabled:opacity-60',
  outline: 'border border-line text-ink hover:bg-surface2 disabled:opacity-50',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium',
        'transition-all duration-150 ease-out select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
