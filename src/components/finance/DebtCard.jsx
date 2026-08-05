import { Percent, CalendarClock, CalendarCheck, Layers } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { Button } from '../ui/Button'
import { formatMoney, formatPercent, formatShortDate, URGENCY_LABELS } from '../../lib/format'
import { cn } from '../../lib/cn'

const URGENCY_VARIANT = {
  ok: 'positive',
  soon: 'warning',
  urgent: 'negative',
  overdue: 'negative',
}

export function DebtCard({ debt, onRegisterPayment }) {
  const isMsi = debt.kind === 'msi'
  const paid = debt.totalAmount - debt.remainingBalance
  const percentPaid = debt.totalAmount > 0 ? (paid / debt.totalAmount) * 100 : 0
  const settled = debt.remainingBalance <= 0

  return (
    <Card className="animate-fade-in-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-ink">{debt.name}</p>
            {isMsi && (
              <Badge variant="brand" className="shrink-0">
                MSI
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted">{debt.type}</p>
        </div>
        <Badge variant={settled ? 'positive' : URGENCY_VARIANT[debt.urgency]} className="shrink-0">
          {settled ? 'Liquidada' : URGENCY_LABELS[debt.urgency]}
        </Badge>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted">Saldo restante</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{formatMoney(debt.remainingBalance)}</p>
        </div>
        <p className="text-xs text-muted">de {formatMoney(debt.totalAmount)}</p>
      </div>

      <div className="mt-3">
        <ProgressBar percent={percentPaid} status="brand" />
        <p className="mt-1.5 text-xs text-muted">
          {isMsi
            ? `Cuota ${debt.installmentsPaid} de ${debt.installments}`
            : `${formatPercent(percentPaid)} pagado`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          {isMsi ? (
            <>
              <Layers className="h-3.5 w-3.5" />
              <span>{debt.interestFree ? 'Sin intereses' : `${debt.interestRate}% mensual`}</span>
            </>
          ) : (
            <>
              <Percent className="h-3.5 w-3.5" />
              <span>{debt.interestRate}% anual</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>Corte {formatShortDate(debt.cutDate)}</span>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5',
            debt.urgency === 'urgent' || debt.urgency === 'overdue' ? 'text-negative' : 'text-muted'
          )}
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          <span>Límite {formatShortDate(debt.dueDate)}</span>
        </div>
      </div>

      {!settled && (
        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => onRegisterPayment(debt)}>
          Registrar pago
        </Button>
      )}
    </Card>
  )
}
