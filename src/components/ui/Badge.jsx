import { cn } from '../../lib/cn'

const VARIANTS = {
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  brand: 'bg-brand-500/15 text-brand-300',
  neutral: 'bg-surface2 text-muted',
}

export function Badge({ children, variant = 'neutral', className, icon: Icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        VARIANTS[variant],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
