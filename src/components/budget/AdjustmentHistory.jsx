import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useBudget } from '../../context/BudgetContext'
import { formatShortDate, formatSignedMoney, parseDateInputValue } from '../../lib/format'
import { cn } from '../../lib/cn'

const MAX_HISTORY = 5

// Últimos movimientos manuales de un sobre (conteos, dinero agregado o sacado),
// cada uno con su X para deshacerlo. No se muestra si el sobre no tiene ninguno.
export function AdjustmentHistory({ envelopeId }) {
  const { plan, removeAdjustment } = useBudget()
  const history = useMemo(
    () => plan.adjustments.filter((a) => a.envelopeId === envelopeId).slice(-MAX_HISTORY).reverse(),
    [plan.adjustments, envelopeId]
  )

  if (history.length === 0) return null

  return (
    <div className="border-t border-line pt-4">
      <p className="mb-1 text-xs font-medium text-muted">Ajustes anteriores de este sobre</p>
      <ul className="divide-y divide-line">
        {history.map((adjustment) => (
          <li key={adjustment.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{adjustment.note || 'Conteo del sobre'}</p>
              <p className="text-xs text-muted">{formatShortDate(parseDateInputValue(adjustment.date))}</p>
            </div>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                adjustment.amount < 0 ? 'text-negative' : 'text-positive'
              )}
            >
              {formatSignedMoney(adjustment.amount, { cents: !Number.isInteger(adjustment.amount) })}
            </span>
            <button
              type="button"
              onClick={() => removeAdjustment(adjustment.id)}
              aria-label="Quitar ajuste"
              title="Quitar ajuste"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
