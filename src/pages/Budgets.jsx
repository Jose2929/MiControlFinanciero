import { useState } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { BudgetRow } from '../components/finance/BudgetRow'
import { MoneyText } from '../components/finance/MoneyText'
import { BudgetModal } from '../components/modals/BudgetModal'
import { getBudgetStatus, formatPercent } from '../lib/format'

export default function Budgets() {
  const { budgetProgress } = useFinance()
  const [modalMode, setModalMode] = useState(null)

  const totalLimit = budgetProgress.reduce((s, b) => s + b.limit, 0)
  const totalSpent = budgetProgress.reduce((s, b) => s + b.spent, 0)
  const totalPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Gastado este mes</p>
            <p className="text-2xl font-bold">
              <MoneyText amount={totalSpent} /> <span className="text-base font-normal text-muted">de {' '}
                <MoneyText amount={totalLimit} variant="muted" className="text-base" />
              </span>
            </p>
          </div>
          <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
            <Plus className="h-4 w-4" />
            Nuevo presupuesto
          </Button>
        </div>
        <div className="mt-4">
          <ProgressBar percent={totalPercent} status={getBudgetStatus(totalPercent)} />
          <p className="mt-1.5 text-xs text-muted">{formatPercent(totalPercent)} del presupuesto total usado</p>
        </div>
      </Card>

      {budgetProgress.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={PiggyBank}
            title="Aún no tienes presupuestos"
            description="Crea un límite mensual por categoría para controlar tus gastos."
            action={
              <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
                Crear presupuesto
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {budgetProgress.map((b) => (
            <BudgetRow key={b.categoryId} budget={b} onEdit={(budget) => setModalMode({ type: 'edit', budget })} />
          ))}
        </div>
      )}

      <BudgetModal mode={modalMode} onClose={() => setModalMode(null)} />
    </div>
  )
}
