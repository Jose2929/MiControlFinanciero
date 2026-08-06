import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { formatMoney, formatPercent } from '../../lib/format'
import { categoryColorValue } from '../../lib/categories'

export function BudgetRow({ budget, onEdit, onRemove }) {
  const { category, spent, limit, percent, status, remaining, isGoal } = budget

  return (
    <Card className="animate-fade-in-up p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${categoryColorValue(category)} 16%, transparent)`,
            color: categoryColorValue(category),
          }}
        >
          <category.icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{category.label}</p>
          <p className="text-xs text-muted">
            {formatMoney(spent)} de {formatMoney(limit)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatPercent(percent)}</span>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(budget)}
            aria-label={`Editar presupuesto de ${category.label}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(budget.categoryId)}
            aria-label={`Eliminar presupuesto de ${category.label}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3">
        <ProgressBar percent={percent} status={status} />
        <p className="mt-1.5 text-xs text-muted">
          {isGoal
            ? remaining > 0
              ? `Faltan ${formatMoney(remaining)} para la meta`
              : 'Meta alcanzada'
            : remaining > 0
              ? `${formatMoney(remaining)} disponibles`
              : 'Límite alcanzado'}
        </p>
      </div>
    </Card>
  )
}
