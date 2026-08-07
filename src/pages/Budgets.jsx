import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, PiggyBank, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { BudgetRow } from '../components/finance/BudgetRow'
import { MoneyText } from '../components/finance/MoneyText'
import { BudgetModal } from '../components/modals/BudgetModal'
import { getBudgetStatus, formatPercent, monthStart, monthEnd, formatMonthLabel } from '../lib/format'

const MAX_OFFSET = 11

export default function Budgets() {
  const navigate = useNavigate()
  const {
    budgetProgress,
    getBudgetProgressForOffset,
    removeBudget,
    monthIncome,
    budgetTotalLimit,
    setBudgetTotalLimit,
  } = useFinance()
  const [modalMode, setModalMode] = useState(null)
  const [monthOffset, setMonthOffset] = useState(0)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalLimitDraft, setTotalLimitDraft] = useState(budgetTotalLimit ?? '')

  useEffect(() => {
    setTotalLimitDraft(budgetTotalLimit ?? '')
  }, [budgetTotalLimit])

  const isCurrentMonth = monthOffset === 0
  const progress = useMemo(
    () => (isCurrentMonth ? budgetProgress : getBudgetProgressForOffset(monthOffset)),
    [isCurrentMonth, budgetProgress, getBudgetProgressForOffset, monthOffset]
  )

  const totalLimit = progress.reduce((s, b) => s + b.limit, 0)
  const totalSpent = progress.reduce((s, b) => s + b.spent, 0)
  const primaryLimit = budgetTotalLimit ?? totalLimit
  const primaryPercent = primaryLimit > 0 ? (totalSpent / primaryLimit) * 100 : 0
  const remainingToAllocate = budgetTotalLimit != null ? budgetTotalLimit - totalLimit : null

  function commitTotalLimit() {
    setBudgetTotalLimit(totalLimitDraft)
    setEditingTotal(false)
  }

  function handleViewExpenses(budget) {
    const from = monthStart(monthOffset).toISOString().slice(0, 10)
    const to = monthEnd(monthOffset).toISOString().slice(0, 10)
    navigate(`/gastos?category=${encodeURIComponent(budget.categoryId)}&from=${from}&to=${to}`)
  }

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
            <div className="flex items-center gap-1.5">
              <p className="text-2xl font-bold">
                <MoneyText amount={totalSpent} />
                {budgetTotalLimit != null && (
                  <span className="text-base font-normal text-muted">
                    {' '}
                    de <MoneyText amount={budgetTotalLimit} variant="muted" className="text-base" />
                  </span>
                )}
              </p>
              {isCurrentMonth && budgetTotalLimit != null && !editingTotal && (
                <button
                  type="button"
                  onClick={() => setEditingTotal(true)}
                  aria-label="Editar saldo disponible por mes"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {isCurrentMonth && budgetTotalLimit == null && !editingTotal && (
              <button
                type="button"
                onClick={() => setEditingTotal(true)}
                className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Definir saldo disponible por mes
              </button>
            )}
          </div>
          {isCurrentMonth && (
            <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
              <Plus className="h-4 w-4" />
              Nuevo presupuesto
            </Button>
          )}
        </div>

        {isCurrentMonth && editingTotal && (
          <div className="mt-3 flex items-end gap-2 border-t border-line pt-4">
            <Input
              autoFocus
              containerClassName="flex-1"
              label="Saldo disponible por mes"
              type="number"
              min="0"
              value={totalLimitDraft}
              onChange={(e) => setTotalLimitDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitTotalLimit()
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => setTotalLimitDraft(monthIncome)}>
              Cargar ingreso mensual
            </Button>
            <Button type="button" size="sm" onClick={commitTotalLimit} aria-label="Guardar saldo disponible">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-4">
          <ProgressBar percent={primaryPercent} status={getBudgetStatus(primaryPercent)} />
          <p className="mt-1.5 text-xs text-muted">
            {formatPercent(primaryPercent)} {budgetTotalLimit != null ? 'del saldo disponible usado' : 'del presupuesto total usado'}
          </p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs text-muted">
            <MoneyText amount={totalLimit} className="text-xs" variant="muted" /> asignado en categorías
            {remainingToAllocate != null && (
              <>
                {' · '}
                {remainingToAllocate < 0 ? (
                  <span className="font-medium text-negative">
                    Asignaste <MoneyText amount={Math.abs(remainingToAllocate)} variant="negative" className="text-xs" /> de más
                  </span>
                ) : (
                  <>Faltan <MoneyText amount={remainingToAllocate} className="text-xs" /> por asignar</>
                )}
              </>
            )}
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
              onViewExpenses={handleViewExpenses}
            />
          ))}
        </div>
      )}

      <BudgetModal mode={modalMode} onClose={() => setModalMode(null)} />
    </div>
  )
}
