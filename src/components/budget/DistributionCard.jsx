import { Link } from 'react-router-dom'
import { AlertCircle, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/cn'
import { formatPercent } from '../../lib/format'
import { money } from './money'

// Color de cada grupo en la barra y en su punto de la lista.
const GROUP_COLOR = {
  tdc: 'bg-warning',
  digital: 'bg-brand-500',
  efectivo: 'bg-positive',
  ahorro: 'bg-sky-400',
}

// "Cada mes entra $X": cómo se reparte entre tarjeta, digital, efectivo y
// ahorro, con una barra, el monto y el porcentaje de cada uno, y si el plan
// cuadra (que no sobre ni falte).
export function DistributionCard({ overview }) {
  const { income, assigned, remaining, balanced, hasIncome, groups, spending } = overview
  const bars = groups.filter((group) => group.amount > 0)

  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{hasIncome ? 'Cada mes entra' : 'Cada mes asignas'}</p>
      <p className="mt-0.5 text-3xl font-bold tabular-nums text-ink">{money(hasIncome ? income : assigned)}</p>

      <div
        role="img"
        aria-label={`Reparto del mes: ${bars.map((g) => `${g.label} ${formatPercent(g.share)}`).join(', ')}`}
        className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface2"
      >
        {bars.map((group) => (
          <div key={group.id} className={cn('h-full', GROUP_COLOR[group.id])} style={{ width: `${group.share}%` }} />
        ))}
      </div>

      <ul className="mt-3 divide-y divide-line">
        {groups.map((group) => (
          <li key={group.id} className="flex items-start gap-3 py-3">
            <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', GROUP_COLOR[group.id])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{group.label}</p>
              <p className="text-xs text-muted">
                {group.parts.length > 0
                  ? group.parts.map((part) => `${part.label} ${money(part.amount)}`).join(' · ')
                  : group.hint}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-ink">{money(group.amount)}</p>
              <p className="text-xs tabular-nums text-muted">{formatPercent(group.share)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-start justify-between gap-3 border-t border-line pt-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-ink">Sobres de gasto diario</p>
          <p className="text-xs text-muted">Los de Débito y los de Efectivo</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-ink">{money(spending.amount)}</p>
          <p className="text-xs tabular-nums text-muted">{formatPercent(spending.share)}</p>
        </div>
      </div>

      {hasIncome && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={balanced ? 'positive' : 'warning'} icon={balanced ? Check : AlertCircle}>
            {balanced ? 'Todo asignado' : remaining > 0 ? `Faltan por asignar ${money(remaining)}` : `Asignas ${money(Math.abs(remaining))} de más`}
          </Badge>
          {!balanced && (
            <Link to="/presupuesto/plan" className="text-xs font-medium text-brand-400 hover:text-brand-300">
              Ajustar en Plan
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
