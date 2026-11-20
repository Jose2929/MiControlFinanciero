import { useState } from 'react'
import { AlertCircle, SlidersHorizontal, X } from 'lucide-react'
import { useBudget } from '../context/BudgetContext'
import { useFinance } from '../context/FinanceContext'
import { MEDIO_ORDER } from '../lib/budget'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { AccountsCard } from '../components/budget/AccountsCard'
import { BalanceCard } from '../components/budget/BalanceCard'
import { IncomesCard } from '../components/budget/IncomesCard'
import { MedioCard } from '../components/budget/MedioCard'
import { SettingsCard } from '../components/budget/SettingsCard'
import { PlanBackupCard } from '../components/budget/PlanBackupCard'
import { PlanImporter } from '../components/budget/PlanImporter'
import { RulesNotice } from '../components/budget/RulesNotice'
import { PlanLineModal } from '../components/modals/PlanLineModal'
import { PlanIncomeModal } from '../components/modals/PlanIncomeModal'

// Presupuesto › Plan: ingresos, fechas y la tabla completa agrupada por medio,
// con la verificación de que cuadra.
export default function BudgetPlan() {
  const { status, plan, hasPlan, writeError, clearWriteError, updateSettings, setAccountMedios, importPlan } =
    useBudget()
  const { accounts } = useFinance()
  const [manual, setManual] = useState(false) // armar el plan a mano en vez de importarlo
  const [lineMode, setLineMode] = useState(null)
  const [incomeMode, setIncomeMode] = useState(null)

  if (status === 'loading') {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">Cargando el plan…</p>
      </Card>
    )
  }

  if (status === 'denied') return <RulesNotice />

  if (status === 'error') {
    return (
      <Card className="p-5">
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el plan"
          description="Revisa tu conexión y recarga la pantalla."
        />
      </Card>
    )
  }

  if (!hasPlan && !manual) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={SlidersHorizontal}
          title="Aún no hay un plan"
          description="Importa tu tabla desde un archivo, o arma el plan a mano agregando ingresos y renglones."
          action={
            <div className="flex flex-col items-center gap-3">
              <PlanImporter label="Importar plan (JSON)" variant="primary" onImport={importPlan} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setManual(true)}>
                Armarlo a mano
              </Button>
            </div>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {writeError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-negative/40 bg-negative-soft p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
          <p className="flex-1 text-ink">{writeError}</p>
          <button
            type="button"
            onClick={clearWriteError}
            aria-label="Cerrar aviso"
            className="shrink-0 text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <BalanceCard plan={plan} />

      <IncomesCard
        incomes={plan.incomes}
        onAdd={() => setIncomeMode({ type: 'create' })}
        onEdit={(income) => setIncomeMode({ type: 'edit', income })}
      />

      {MEDIO_ORDER.map((medio) => (
        <MedioCard
          key={medio}
          medio={medio}
          lines={plan.lines.filter((l) => l.medio === medio)}
          onAdd={(m) => setLineMode({ type: 'create', medio: m })}
          onEdit={(line) => setLineMode({ type: 'edit', line })}
        />
      ))}

      <AccountsCard accounts={accounts} accountMedios={plan.accountMedios} onChange={setAccountMedios} />

      <SettingsCard settings={plan.settings} onChange={updateSettings} />

      <PlanBackupCard plan={plan} onImport={importPlan} />

      <PlanLineModal mode={lineMode} onClose={() => setLineMode(null)} />
      <PlanIncomeModal mode={incomeMode} onClose={() => setIncomeMode(null)} />
    </div>
  )
}
