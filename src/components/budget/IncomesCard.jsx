import { Pencil, Plus } from 'lucide-react'
import { Card } from '../ui/Card'
import { MEDIO_LABELS } from '../../lib/budget'
import { formatDays, money } from './money'

export function IncomesCard({ incomes, onAdd, onEdit }) {
  return (
    <Card className="p-4">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-ink">Ingresos</h3>
        <p className="text-xs text-muted">Cuánto entra, en qué días y qué medios cubre cada sueldo.</p>
      </div>

      {incomes.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">Aún no hay ingresos.</p>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {incomes.map((income) => (
            <button
              key={income.id}
              type="button"
              onClick={() => onEdit(income)}
              aria-label={`Editar ${income.name}`}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-surface2/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{income.name}</p>
                <p className="text-xs text-muted">
                  Se paga el {formatDays(income.payDays)} · cubre{' '}
                  {income.covers.length > 0 ? income.covers.map((m) => MEDIO_LABELS[m]).join(', ') : 'nada'}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(income.amount)}</span>
              <Pencil className="h-4 w-4 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2.5 text-sm font-medium text-brand-400 transition-colors hover:bg-surface2/60 hover:text-brand-300"
      >
        <Plus className="h-4 w-4" />
        Agregar ingreso
      </button>
    </Card>
  )
}
