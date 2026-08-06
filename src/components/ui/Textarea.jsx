import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export const Textarea = forwardRef(function Textarea(
  { label, error, className, containerClassName, rows = 3, ...props },
  ref
) {
  return (
    <label className={cn('block', containerClassName)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-xl border bg-surface2 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted',
          'transition-colors duration-150 outline-none resize-none',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
          error ? 'border-negative' : 'border-line',
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
    </label>
  )
})
