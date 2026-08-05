import { ArrowDownRight, ArrowUpRight, HandCoins, Wallet } from 'lucide-react'
import { formatMoney } from '../../lib/format'

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

  return (
    <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 shadow-glow sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl" />

      <div className="relative">
        <p className="text-sm font-medium text-white/80">Disponible este mes</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-white sm:text-5xl">
          {formatMoney(available)}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/15 pt-5 sm:grid-cols-3">
          <Term icon={ArrowUpRight} label="Ingresos" value={income} sign="+" sub={incomeSub} />
          <Term icon={ArrowDownRight} label="Gastos" value={expenses} sign="−" />
          <Term icon={HandCoins} label="Pagos de deuda" value={debtPayments} sign="−" />
        </div>
      </div>
    </div>
  )
}
