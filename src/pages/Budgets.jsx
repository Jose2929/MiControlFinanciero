import { useMemo, useState } from 'react'
import { Plus, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { BudgetRow } from '../components/finance/BudgetRow'
import { MoneyText } from '../components/finance/MoneyText'
import { BudgetModal } from '../components/modals/BudgetModal'
import { getBudgetStatus, formatPercent, monthStart, formatMonthLabel } from '../lib/format'

const MAX_OFFSET = 11

export default function Budgets() {
  const { budgetProgress, getBudgetProgressForOffset, removeBudget, monthIncome } = useFinance()
  const [modalMode, setModalMode] = useState(null)
  const [monthOffset, setMonthOffset] = useState(0)

  const isCurrentMonth = monthOffset === 0
  const progress = useMemo(
    () => (isCurrentMonth ? budgetProgress : getBudgetProgressForOffset(monthOffset)),
    [isCurrentMonth, budgetProgress, getBudgetProgressForOffset, monthOffset]
  )

  const totalLimit = progress.reduce((s, b) => s + b.limit, 0)
  const totalSpent = progress.reduce((s, b) => s + b.spent, 0)
  const totalPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0
  const incomeAllocatedPercent = monthIncome > 0 ? (totalLimit / monthIncome) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(o + 1, MAX_OFFSET))}
          disabled={monthOffset >= MAX_OFFSET}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize text-ink">{formatMonthLabel(monthStart(monthOffset))}</p>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.max(o - 1, 0))}
          disabled={isCurrentMonth}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">{isCurrentMonth ? 'Gastado este mes' : 'Gastado ese mes'}</p>
            <p className="text-2xl font-bold">
              <MoneyText amount={totalSpent} /> <span className="text-base font-normal text-muted">de {' '}
                <MoneyText amount={totalLimit} variant="muted" className="text-base" />
              </span>
            </p>
          </div>
          {isCurrentMonth && (
            <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
              <Plus className="h-4 w-4" />
              Nuevo presupuesto
            </Button>
          )}
        </div>
        <div className="mt-4">
          <ProgressBar percent={totalPercent} status={getBudgetStatus(totalPercent)} />
          <p className="mt-1.5 text-xs text-muted">{formatPercent(totalPercent)} del presupuesto total usado</p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <ProgressBar percent={incomeAllocatedPercent} status="brand" />
          <p className="mt-1.5 text-xs text-muted">
            <MoneyText amount={totalLimit} className="text-xs" /> asignado · {formatPercent(incomeAllocatedPercent)} de
            tu ingreso mensual (<MoneyText amount={monthIncome} variant="muted" className="text-xs" />)
          </p>
        </div>

        {!isCurrentMonth && (
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Viendo un mes anterior — de solo lectura.
          </p>
        )}
      </Card>

      {progress.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={PiggyBank}
            title="Aún no tienes presupuestos"
            description="Crea un límite mensual por categoría para controlar tus gastos."
            action={
              isCurrentMonth && (
                <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
                  Crear presupuesto
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {progress.map((b) => (
            <BudgetRow
              key={b.categoryId}
              budget={b}
              onEdit={isCurrentMonth ? (budget) => setModalMode({ type: 'edit', budget }) : undefined}
              onRemove={isCurrentMonth ? removeBudget : undefined}
            />
          ))}
        </div>
      )}

      <BudgetModal mode={modalMode} onClose={() => setModalMode(null)} />
    </div>
  )
}
