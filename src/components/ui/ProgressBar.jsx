import { cn } from '../../lib/cn'

const STATUS_COLORS = {
  ok: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-negative',
  brand: 'brand-gradient',
}

export function ProgressBar({ percent, status = 'brand', className, trackClassName }) {
  const clamped = Math.max(0, Math.min(percent, 100))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface2', trackClassName)}>
      <div
        className={cn(
          'h-full rounded-full animate-progress-fill transition-[width] duration-500 ease-out',
          STATUS_COLORS[status] || STATUS_COLORS.brand,
          className
        )}
        style={{ width: `${clamped}%`, '--fill-to': `${clamped}%` }}
      />
    </div>
  )
}
