import { ArrowDownRight, ArrowUpRight, HandCoins } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'
import { ProgressBar } from '../ui/ProgressBar'

// Umbrales de uso de los ingresos (gastos + pagos de deuda sobre ingresos).
// Verde: cómodo · Amarillo: cuidado · Rojo: al límite.
const GREEN_MAX = 60 // menos de 60% usado -> verde
const RED_MIN = 85 // 85% o más usado -> rojo (75% ya cae en amarillo, dentro de 60-85)

function usageStatus(percent) {
  if (percent >= RED_MIN) return 'danger'
  if (percent >= GREEN_MAX) return 'warning'
  return 'ok'
}

const STATUS_TEXT = {
  ok: 'text-positive',
  warning: 'text-warning',
  danger: 'text-negative',
}

function Term({ icon: Icon, label, value, sign, sub }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icon className="h-4.5 w-4.5 text-white" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-white/70">
          {sign} {label}
        </p>
        <p className="truncate text-sm font-semibold tabular-nums text-white">{formatMoney(value)}</p>
        {sub && <p className="truncate text-[11px] text-white/60">{sub}</p>}
      </div>
    </div>
  )
}

export function BalanceHero({ income, expenses, debtPayments, available, incomeBySource }) {
  const incomeSub =
    incomeBySource && incomeBySource.length > 0
      ? incomeBySource.map((s) => `${s.label} ${formatMoney(s.amount)}`).join(' · ')
      : null

  const used = expenses + debtPayments
  const usedPercent = income > 0 ? (used / income) * 100 : used > 0 ? 100 : 0
  const status = usageStatus(usedPercent)

  return (
    <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 shadow-glow sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl" />

      <div className="relative">
        <p className="text-sm font-medium text-white/80">Disponible este mes</p>
        <p
          className={cn(
            'mt-1 text-4xl font-bold tabular-nums drop-shadow-sm sm:text-5xl',
            STATUS_TEXT[status]
          )}
        >
          {formatMoney(available)}
        </p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-white/70">Ingresos usados</span>
            <span className={cn('font-semibold tabular-nums', STATUS_TEXT[status])}>
              {Math.round(usedPercent)}%
            </span>
          </div>
          <ProgressBar percent={usedPercent} status={status} trackClassName="bg-white/20" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/15 pt-5 sm:grid-cols-3">
          <Term icon={ArrowUpRight} label="Ingresos" value={income} sign="+" sub={incomeSub} />
          <Term icon={ArrowDownRight} label="Gastos" value={expenses} sign="−" />
          <Term icon={HandCoins} label="Pagos de deuda" value={debtPayments} sign="−" />
        </div>
      </div>
    </div>
  )
}
