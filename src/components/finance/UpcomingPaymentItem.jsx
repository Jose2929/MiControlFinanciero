import { Link } from 'react-router-dom'
import { formatMoney, formatRelativeDue, URGENCY_LABELS } from '../../lib/format'
import { Badge } from '../ui/Badge'

const URGENCY_VARIANT = {
  ok: 'positive',
  soon: 'warning',
  urgent: 'negative',
  overdue: 'negative',
}

const DOT_COLOR = {
  ok: 'bg-positive',
  soon: 'bg-warning',
  urgent: 'bg-negative',
  overdue: 'bg-negative',
}

export function UpcomingPaymentItem({ debt }) {
  return (
    <Link
      to="/deudas"
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface2"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[debt.urgency]}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{debt.name}</p>
        <p className="text-xs text-muted">{formatRelativeDue(debt.dueDate)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink">{formatMoney(debt.minPayment)}</p>
        <Badge variant={URGENCY_VARIANT[debt.urgency]} className="mt-0.5">
          {URGENCY_LABELS[debt.urgency]}
        </Badge>
      </div>
    </Link>
  )
}
