import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ name, size = 'md', className }) {
  return (
    <div
      className={cn(
        'brand-gradient flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        SIZES[size],
        className
      )}
    >
      {initials(name)}
    </div>
  )
}
