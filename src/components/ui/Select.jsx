import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Select = forwardRef(function Select(
  { label, className, containerClassName, children, ...props },
  ref
) {
  return (
    <label className={cn('block', containerClassName)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border border-line bg-surface2 px-3.5 pr-9 text-sm text-ink',
            'transition-colors duration-150 outline-none',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  )
})
