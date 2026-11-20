import { AlertCircle, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { buildFortnightPlan, checkBalance } from '../../lib/budget'
import { cn } from '../../lib/cn'
import { money } from './money'

// Verificación del plan: ¿cada ingreso queda en $0 y lo retenido de las
// quincenas alcanza para pagar la TDC completa?
export function BalanceCard({ plan }) {
  if (plan.incomes.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm font-medium text-ink">Verificación del plan</p>
        <p className="mt-1 text-sm text-muted">
          Agrega tus ingresos para comprobar que el plan cuadra (que no sobre ni falte dinero).
        </p>
      </Card>
    )
  }

  const balance = checkBalance(plan)
  const fortnight = buildFortnightPlan(plan)
  const { balanced, remaining } = balance
  const label = balanced ? 'Restante' : remaining > 0 ? 'Sin asignar' : 'Te pasaste por'

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p
            className={cn(
              'mt-0.5 text-3xl font-bold tabular-nums',
              balanced ? 'text-positive' : remaining > 0 ? 'text-warning' : 'text-negative'
            )}
          >
            {money(Math.abs(remaining))}
          </p>
        </div>
        <Badge variant={balanced ? 'positive' : 'warning'} icon={balanced ? Check : AlertCircle}>
          {balanced ? 'Cuadra' : 'No cuadra'}
        </Badge>
      </div>

      <ul className="mt-4 divide-y divide-line text-sm">
        {balance.incomes.map((income) => (
          <li key={income.id} className="flex items-center justify-between gap-3 py-2">
            <span className="truncate font-medium text-ink">{income.name}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {money(income.amount)} − {money(income.assigned)} ={' '}
              <span className={cn('font-semibold', income.balanced ? 'text-positive' : 'text-negative')}>
                {money(income.remaining)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {balance.uncovered > 0 && (
        <p className="mt-3 text-xs text-warning">
          {money(balance.uncovered)} están en medios que ningún ingreso cubre.
        </p>
      )}

      {fortnight && (
        <p className={cn('mt-3 text-xs', fortnight.tdcGap === 0 ? 'text-muted' : 'text-warning')}>
          {fortnight.tdcGap === 0
            ? `Lo retenido de tus sueldos paga la TDC completa (${money(fortnight.tdcDue)}).`
            : fortnight.tdcGap > 0
              ? `Lo retenido de tus sueldos no alcanza para la TDC: faltan ${money(fortnight.tdcGap)}.`
              : `Lo retenido de tus sueldos paga la TDC y sobran ${money(Math.abs(fortnight.tdcGap))}.`}
        </p>
      )}
      {fortnight && !fortnight.spendTransferDayValid && (
        <p className="mt-1 text-xs text-warning">
          El día de reparto ({plan.settings.spendTransferDay}) no es un día de pago de tu sueldo.
        </p>
      )}
    </Card>
  )
}
