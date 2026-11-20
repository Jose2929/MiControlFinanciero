import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBudget } from '../context/BudgetContext'
import { EVENT_KINDS, buildMonthEvents, countChecks, monthKey } from '../lib/budgetCalendar'
import { capitalize } from '../lib/format'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { CalendarGrid } from '../components/budget/CalendarGrid'
import { DayDetail } from '../components/budget/DayDetail'
import { KIND_META } from '../components/budget/calendarKinds'
import { RulesNotice } from '../components/budget/RulesNotice'
import { money } from '../components/budget/money'
import { cn } from '../lib/cn'

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className={cn('truncate text-sm font-semibold tabular-nums', tone)}>{value}</dd>
    </div>
  )
}

// Presupuesto › Calendario: el mes en una cuadrícula, con un icono en cada día
// que tiene algo (sueldo, transferencia, cargo, pago o corte de la TDC, ahorro).
// Al tocar un día se ve el detalle y se puede marcar lo que ya se hizo; las
// palomitas solo marcan: no registran movimientos ni tocan tus cuentas.
//
// `today` solo existe para poder probar la pantalla con una fecha fija.
export default function BudgetCalendar({ today: todayProp }) {
  const { status, plan, hasPlan, setCheck } = useBudget()
  const today = useMemo(() => todayProp || new Date(), [todayProp])
  const [offset, setOffset] = useState(0) // meses respecto al de hoy
  const [picked, setPicked] = useState(null) // día tocado; null = el de hoy (o el primero con algo)
  const detailRef = useRef(null)

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = base.getFullYear()
  const month = base.getMonth()
  const key = monthKey(year, month)

  const calendar = useMemo(() => (hasPlan ? buildMonthEvents(plan, year, month) : null), [hasPlan, plan, year, month])

  if (status === 'loading') {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">Cargando el calendario…</p>
      </Card>
    )
  }
  if (status === 'denied') return <RulesNotice />
  if (status === 'error') {
    return (
      <Card className="p-5">
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el calendario"
          description="Revisa tu conexión y recarga la pantalla."
        />
      </Card>
    )
  }
  if (!hasPlan || !calendar) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={CalendarDays}
          title="Primero arma tu plan"
          description="Importa o captura tu tabla en la pestaña Plan; aquí verás qué se cobra, se paga o se ahorra cada día."
          action={
            <Link to="/presupuesto/plan" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              Ir a Plan
            </Link>
          }
        />
      </Card>
    )
  }

  const checks = plan.checks?.[key] || {}
  const todayDay = offset === 0 ? today.getDate() : null
  const firstEventDay = Object.keys(calendar.byDay).map(Number).sort((a, b) => a - b)[0]
  const selectedDay = picked ?? todayDay ?? firstEventDay ?? 1
  const { done, total } = countChecks(calendar.events, checks)
  const legend = EVENT_KINDS.filter((kind) => calendar.events.some((e) => e.kind === kind))
  const monthLabel = capitalize(new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(base))

  const goTo = (next) => {
    setOffset(next)
    setPicked(null)
  }

  // En el celular el detalle queda debajo de la cuadrícula: al tocar un día, la
  // pantalla baja lo justo para que se vea.
  const pickDay = (day) => {
    setPicked(day)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(offset - 1)}
          aria-label="Mes anterior"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-sm font-semibold text-ink">{monthLabel}</p>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => goTo(0)}
              className="text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              Volver a hoy
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => goTo(offset + 1)}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-ink">Este mes</p>
          <p className="text-xs text-muted">
            {done} de {total} marcados
          </p>
        </div>
        <ProgressBar percent={total > 0 ? (done / total) * 100 : 0} status={done === total && total > 0 ? 'ok' : 'brand'} className="mt-2" />
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Entra" value={money(calendar.totals.ingreso)} tone="text-positive" />
          <Stat label="Pago TDC" value={money(calendar.totals.pago)} />
          <Stat label="A ahorro" value={money(calendar.totals.ahorro)} />
        </dl>
      </Card>

      <Card className="p-3">
        <CalendarGrid
          year={year}
          month={month}
          byDay={calendar.byDay}
          checks={checks}
          selectedDay={selectedDay}
          todayDay={todayDay}
          onSelect={pickDay}
        />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3" aria-label="Qué significa cada icono">
          {legend.map((kind) => {
            const { icon: Icon, label, tone } = KIND_META[kind]
            return (
              <li key={kind} className="flex items-center gap-1.5 text-xs text-muted">
                <Icon className={cn('h-3.5 w-3.5', tone)} aria-hidden="true" />
                {label}
              </li>
            )
          })}
        </ul>
      </Card>

      <div ref={detailRef} className="scroll-mb-24">
        <DayDetail
          year={year}
          month={month}
          day={selectedDay}
          events={calendar.byDay[selectedDay] || []}
          checks={checks}
          canToggle={status === 'ready'}
          onToggle={(event, checked) => setCheck(key, event.key, checked)}
        />
      </div>
    </div>
  )
}
