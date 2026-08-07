import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpCircle, ArrowDownCircle, HandCoins, CalendarClock, Repeat } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { BalanceHero } from '../components/finance/BalanceHero'
import { StatCard } from '../components/finance/StatCard'
import { CategoryDonut } from '../components/charts/CategoryDonut'
import { TrendAreaChart } from '../components/charts/TrendAreaChart'
import { UpcomingPaymentItem } from '../components/finance/UpcomingPaymentItem'
import { DebtBreakdownModal } from '../components/modals/DebtBreakdownModal'
import { formatMoney, formatRelativeDue, URGENCY_LABELS } from '../lib/format'

const URGENCY_VARIANT = { ok: 'positive', soon: 'warning', urgent: 'negative', overdue: 'negative' }

function pctDelta(current, previous) {
  if (!previous) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export default function Dashboard() {
  const {
    accounts,
    monthIncome,
    monthExpenses,
    monthDebtPayments,
    available,
    prevMonthIncome,
    prevMonthExpenses,
    totalDebt,
    prevTotalDebt,
    spendByCategory,
    trend6Months,
    upcomingPayments,
    monthIncomeBySource,
    recurringStatus,
  } = useFinance()

  const soonPayments = upcomingPayments.filter((d) => d.urgency !== 'ok').slice(0, 5)
  const pendingRecurring = recurringStatus.filter((b) => !b.confirmed)
  const [showDebtBreakdown, setShowDebtBreakdown] = useState(false)

  return (
    <div className="space-y-6">
      <BalanceHero
        income={monthIncome}
        expenses={monthExpenses}
        debtPayments={monthDebtPayments}
        available={available}
        incomeBySource={monthIncomeBySource}
        accounts={accounts}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ArrowUpCircle}
          label="Ingresos del mes"
          value={monthIncome}
          variant="positive"
          delta={pctDelta(monthIncome, prevMonthIncome)}
          deltaGoodDirection="up"
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Gastos del mes"
          value={monthExpenses}
          variant="negative"
          delta={pctDelta(monthExpenses, prevMonthExpenses)}
          deltaGoodDirection="down"
        />
        <StatCard
          icon={HandCoins}
          label="Deuda total pendiente"
          value={totalDebt}
          variant="warning"
          delta={pctDelta(totalDebt, prevTotalDebt)}
          deltaGoodDirection="down"
          onClick={() => setShowDebtBreakdown(true)}
        />
      </div>

      <DebtBreakdownModal open={showDebtBreakdown} onClose={() => setShowDebtBreakdown(false)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="animate-fade-in-up p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-ink">Gastos por categoría</h2>
          <CategoryDonut data={spendByCategory} />
        </Card>

        <Card className="animate-fade-in-up p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-ink">Tendencia de gastos</h2>
          <p className="mb-2 text-xs text-muted">Últimos 6 meses</p>
          <TrendAreaChart data={trend6Months} />
        </Card>
      </div>

      <Card className="animate-fade-in-up p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">Próximos pagos</h2>
        <p className="mb-2 text-xs text-muted">Deudas por vencer</p>
        {soonPayments.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sin pagos urgentes"
            description="No tienes deudas por vencer en los próximos días."
          />
        ) : (
          <div className="-mx-2 divide-y divide-line">
            {soonPayments.map((debt) => (
              <UpcomingPaymentItem key={debt.id} debt={debt} />
            ))}
          </div>
        )}
      </Card>

      <Card className="animate-fade-in-up p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Pagos recurrentes</h2>
            <p className="text-xs text-muted">Pendientes de confirmar este mes</p>
          </div>
          <Link to="/recurrentes" className="text-xs font-medium text-brand-400 hover:text-brand-300">
            Ver todos
          </Link>
        </div>
        {pendingRecurring.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Todo confirmado"
            description="No tienes pagos recurrentes pendientes de confirmar este mes."
          />
        ) : (
          <div className="-mx-2 divide-y divide-line">
            {pendingRecurring.map((bill) => (
              <Link
                key={bill.id}
                to="/recurrentes"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{bill.name}</p>
                  <p className="text-xs text-muted">{formatRelativeDue(bill.dueDate)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink">{formatMoney(bill.estimatedAmount)}</p>
                  <Badge variant={URGENCY_VARIANT[bill.urgency]} className="mt-0.5">
                    {URGENCY_LABELS[bill.urgency]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
