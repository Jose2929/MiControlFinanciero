import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export const Input = forwardRef(function Input(
  { label, error, icon: Icon, className, containerClassName, ...props },
  ref
) {
  return (
    <label className={cn('block', containerClassName)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}
        <input
          ref={ref}
          className={cn(
            'h-11 w-full rounded-xl border bg-surface2 px-3.5 text-sm text-ink placeholder:text-muted',
            'transition-colors duration-150 outline-none',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
            error ? 'border-negative' : 'border-line',
            Icon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
    </label>
  )
})
