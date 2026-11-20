import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, PieChart } from 'lucide-react'
import { useBudget } from '../context/BudgetContext'
import { useFinance } from '../context/FinanceContext'
import { buildOverview, summarizeAvailable } from '../lib/budgetOverview'
import { computeEnvelopes, cycleRange } from '../lib/budgetBalances'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { AvailableNowCard } from '../components/budget/AvailableNowCard'
import { DistributionCard } from '../components/budget/DistributionCard'
import { OverviewSection } from '../components/budget/OverviewSection'
import { RulesNotice } from '../components/budget/RulesNotice'

// Presupuesto › Resumen: de un vistazo, cuánto entra cada mes y cómo se reparte
// (tarjeta, digital, efectivo, ahorro), cuánto tienes ahora en los sobres y qué
// hay dentro de cada cosa.
//
// `today` solo existe para poder probar la pantalla con una fecha fija.
export default function BudgetOverview({ today: todayProp }) {
  const { status, plan, hasPlan } = useBudget()
  const { transactions } = useFinance()
  const today = useMemo(() => todayProp || new Date(), [todayProp])

  const overview = useMemo(() => (hasPlan ? buildOverview(plan) : null), [hasPlan, plan])
  const range = useMemo(() => (hasPlan && plan.settings.startCycle ? cycleRange(plan, today) : null), [hasPlan, plan, today])
  const result = useMemo(
    () => (range ? computeEnvelopes({ plan, transactions, cycle: range.last, today }) : null),
    [range, plan, transactions, today]
  )
  const available = useMemo(() => (result ? summarizeAvailable(result.items) : null), [result])

  if (status === 'loading') {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">Cargando el resumen…</p>
      </Card>
    )
  }
  if (status === 'denied') return <RulesNotice />
  if (status === 'error') {
    return (
      <Card className="p-5">
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el resumen"
          description="Revisa tu conexión y recarga la pantalla."
        />
      </Card>
    )
  }
  if (!overview) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={PieChart}
          title="Primero arma tu plan"
          description="Importa o captura tu tabla en la pestaña Plan; aquí verás cuánto entra, cómo se reparte y qué hay en cada cosa."
          action={
            <Link to="/presupuesto/plan" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              Ir a Plan
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <DistributionCard overview={overview} />
      <AvailableNowCard available={available} cycle={range?.last} progress={result?.progress} />

      {overview.sections.length > 0 && (
        <section className="space-y-3">
          <div className="px-1">
            <h3 className="text-sm font-semibold text-ink">Qué hay en cada cosa</h3>
            <p className="text-xs text-muted">Toca un bloque para ver sus renglones.</p>
          </div>
          {overview.sections.map((section) => (
            <OverviewSection key={section.id} section={section} />
          ))}
        </section>
      )}
    </div>
  )
}
