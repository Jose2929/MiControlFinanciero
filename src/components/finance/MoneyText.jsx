import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'

const COLORS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-ink',
  muted: 'text-muted',
}

export function MoneyText({ amount, variant = 'neutral', className, cents = false }) {
  return (
    <span className={cn('tabular-nums', COLORS[variant], className)}>
      {formatMoney(amount, { cents })}
    </span>
  )
}
