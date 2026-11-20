import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Wallet } from 'lucide-react'
import { useBudget } from '../context/BudgetContext'
import { useFinance } from '../context/FinanceContext'
import { shiftCycle } from '../lib/budget'
import { computeEnvelopes, cycleRange, cyclesBetween, findUnclassified } from '../lib/budgetBalances'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { CycleNav } from '../components/budget/CycleNav'
import { EnvelopeCard } from '../components/budget/EnvelopeCard'
import { PocketCard } from '../components/budget/PocketCard'
import { RulesNotice } from '../components/budget/RulesNotice'
import { StartCycleCard } from '../components/budget/StartCycleCard'
import { UnclassifiedCard } from '../components/budget/UnclassifiedCard'
import { money } from '../components/budget/money'
import { cn } from '../lib/cn'

function Section({ title, description, total, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {total != null && (
          <p className="shrink-0 text-xs text-muted">
            Disponible <span className="font-semibold tabular-nums text-ink">{money(total)}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

const totalOf = (items) => items.reduce((sum, item) => sum + item.balance, 0)

// Presupuesto › Sobres: saldo de cada sobre en el ciclo elegido, con lo que
// arrastra de ciclos anteriores, el ritmo de gasto y un aproximado por semana.
export default function BudgetEnvelopes() {
  const { status, plan, hasPlan, updateSettings } = useBudget()
  const { transactions, accounts, findCategory, updateTransaction } = useFinance()
  const today = useMemo(() => new Date(), [])
  const [back, setBack] = useState(0) // cuántos ciclos hacia atrás del último visible

  const range = useMemo(() => (hasPlan ? cycleRange(plan, today) : null), [hasPlan, plan, today])
  const cycleCount = useMemo(() => (range ? cyclesBetween(range.first, range.last).length : 0), [range])
  const cycle = useMemo(
    () => (range ? shiftCycle(range.last, -Math.min(back, cycleCount - 1)) : null),
    [range, back, cycleCount]
  )

  const result = useMemo(
    () => (cycle ? computeEnvelopes({ plan, transactions, cycle, today }) : null),
    [plan, transactions, cycle, today]
  )
  const categoryLabel = (id) => findCategory(id)?.label || ''
  const unclassified = useMemo(
    () =>
      cycle
        ? findUnclassified({ plan, transactions, cycle, categoryLabelOf: (id) => findCategory(id)?.label || '' })
        : [],
    [plan, transactions, cycle, findCategory]
  )
  const accountNames = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts])

  if (status === 'loading') {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">Cargando los sobres…</p>
      </Card>
    )
  }
  if (status === 'denied') return <RulesNotice />
  if (status === 'error') {
    return (
      <Card className="p-5">
        <EmptyState
          icon={AlertCircle}
          title="No se pudieron cargar los sobres"
          description="Revisa tu conexión y recarga la pantalla."
        />
      </Card>
    )
  }

  if (!hasPlan) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={Wallet}
          title="Primero arma tu plan"
          description="Importa o captura tu tabla en la pestaña Plan; aquí verás el saldo de cada sobre."
          action={
            <Link to="/presupuesto/plan" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              Ir a Plan
            </Link>
          }
        />
      </Card>
    )
  }

  if (!plan.settings.startCycle) {
    return <StartCycleCard cycleStartDay={plan.settings.cycleStartDay} onChoose={(key) => updateSettings({ startCycle: key })} />
  }

  const items = result?.items ?? []
  const sobres = (medio) => items.filter((i) => i.line.kind === 'sobre' && i.line.medio === medio)
  const debito = sobres('debito')
  const efectivo = sobres('efectivo')
  const fondo = items.filter((i) => i.line.kind === 'fondo')
  const pockets = items.filter((i) => i.line.kind === 'bolsillo')
  const noAccounts = Object.keys(plan.accountMedios).length === 0

  return (
    <div className="space-y-5">
      <CycleNav
        cycle={cycle}
        progress={result.progress}
        canPrev={back < cycleCount - 1}
        canNext={back > 0}
        onPrev={() => setBack((b) => Math.min(b + 1, cycleCount - 1))}
        onNext={() => setBack((b) => Math.max(b - 1, 0))}
      />

      {noAccounts && (
        <Card className="border-warning/40 p-4">
          <p className="text-sm text-ink">Todavía no hay cuentas ligadas a un medio.</p>
          <p className="mt-1 text-xs text-muted">
            Sin eso, ningún gasto cuenta en los sobres.{' '}
            <Link to="/presupuesto/plan" className="font-medium text-brand-400 hover:text-brand-300">
              Asígnalas en Plan → Cuentas de la app
            </Link>
            .
          </p>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm text-muted">{result.isPast ? 'Disponible al cierre del ciclo' : 'Disponible en sobres'}</p>
        <p
          className={cn(
            'mt-0.5 text-3xl font-bold tabular-nums',
            result.spendTotals.balance < 0 ? 'text-negative' : 'text-ink'
          )}
        >
          {money(result.spendTotals.balance)}
        </p>
        <p className="mt-2 text-xs text-muted">
          Asignado del ciclo {money(result.spendTotals.assigned)} · Gastado {money(result.spendTotals.spent)}
          {result.spendTotals.opening !== 0 && <> · Arrastre {money(result.spendTotals.opening)}</>}
        </p>
      </Card>

      <UnclassifiedCard
        items={unclassified}
        accountNames={accountNames}
        categoryLabel={categoryLabel}
        onAssign={(transactionId, envelopeId) => updateTransaction(transactionId, { envelopeId })}
        onAssignSuggested={(list) =>
          list.forEach(({ transaction, suggestion }) =>
            updateTransaction(transaction.id, { envelopeId: suggestion.lineId })
          )
        }
      />

      {items.length === 0 && (
        <Card className="p-5">
          <EmptyState
            icon={Wallet}
            title="Tu plan aún no tiene sobres"
            description="Agrega renglones en Débito o Efectivo en la pestaña Plan."
          />
        </Card>
      )}

      {debito.length > 0 && (
        <Section title="Débito" description="Gasto diario" total={totalOf(debito)}>
          {debito.map((item) => (
            <EnvelopeCard key={item.line.id} item={item} progress={result.progress} />
          ))}
        </Section>
      )}

      {efectivo.length > 0 && (
        <Section title="Efectivo" description="Lo que retiras del débito" total={totalOf(efectivo)}>
          {efectivo.map((item) => (
            <EnvelopeCard key={item.line.id} item={item} progress={result.progress} />
          ))}
        </Section>
      )}

      {fondo.length > 0 && (
        <Section title="Fondo general" description="Para cualquier gasto" total={totalOf(fondo)}>
          {fondo.map((item) => (
            <EnvelopeCard key={item.line.id} item={item} progress={result.progress} />
          ))}
        </Section>
      )}

      {pockets.length > 0 && (
        <Section title="Bolsillos de TDC2" description="Lo que apartas cada mes para cobros del año">
          {pockets.map((item) => (
            <PocketCard key={item.line.id} item={item} />
          ))}
        </Section>
      )}
    </div>
  )
}
