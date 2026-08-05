import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatMoney, formatShortDate, URGENCY_LABELS } from '../../lib/format'
import { categoryColorValue } from '../../lib/categories'

const URGENCY_VARIANT = {
  ok: 'positive',
  soon: 'warning',
  urgent: 'negative',
  overdue: 'negative',
}

export function RecurringBillCard({ status, category, onConfirm, onEdit, onRemove }) {
  const { confirmed } = status

  return (
    <Card className="animate-fade-in-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `color-mix(in srgb, ${categoryColorValue(category)} 16%, transparent)`,
              color: categoryColorValue(category),
            }}
          >
            <category.icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{status.name}</p>
            <p className="truncate text-xs text-muted">
              {category.label} · día {status.dueDay}
            </p>
          </div>
        </div>
        <Badge variant={confirmed ? 'positive' : URGENCY_VARIANT[status.urgency]} className="shrink-0">
          {confirmed ? 'Pagado' : URGENCY_LABELS[status.urgency]}
        </Badge>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted">{confirmed ? 'Monto confirmado' : 'Monto estimado'}</p>
          <p className="text-2xl font-bold tabular-nums text-ink">
            {formatMoney(confirmed ? status.confirmation.amount : status.estimatedAmount)}
          </p>
        </div>
        <p className="text-xs text-muted">{formatShortDate(status.dueDate)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        {!confirmed && (
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => onConfirm(status)}>
            Confirmar pago
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onEdit(status)} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRemove(status.id)} aria-label="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
