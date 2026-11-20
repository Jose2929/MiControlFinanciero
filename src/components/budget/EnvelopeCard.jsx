import { Card } from '../ui/Card'
import { cn } from '../../lib/cn'
import { money } from './money'

const FILL = { ok: 'bg-positive', warning: 'bg-warning', danger: 'bg-negative' }

// Barra de gasto del ciclo con una marca en el ritmo esperado: el relleno es
// lo gastado frente a lo asignado; la marca, dónde "deberías ir" hoy.
function PaceBar({ spent, assigned, expected, status }) {
  const fill = assigned > 0 ? Math.min(spent / assigned, 1) * 100 : spent > 0 ? 100 : 0
  const marker = assigned > 0 ? Math.min(expected / assigned, 1) * 100 : 0
  return (
    <div
      role="img"
      aria-label={`Gastado ${money(spent)} de ${money(assigned)}; ritmo esperado ${money(expected)}`}
      className="relative h-2 w-full rounded-full bg-surface2"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', FILL[status])} style={{ width: `${fill}%` }} />
      {marker > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/70"
          style={{ left: `calc(${marker}% - 1px)` }}
        />
      )}
    </div>
  )
}

function paceText(paceDiff) {
  if (paceDiff > 0) return { text: `${money(paceDiff)} por encima del ritmo`, tone: 'text-warning' }
  if (paceDiff < 0) return { text: `${money(Math.abs(paceDiff))} por debajo del ritmo`, tone: 'text-positive' }
  return { text: 'Justo en el ritmo', tone: 'text-positive' }
}

function weeksText(daysLeft) {
  if (daysLeft < 7) return daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`
  const weeks = Math.ceil(daysLeft / 7)
  return `${weeks} semanas restantes`
}

// Un sobre de gasto (Débito, Efectivo o el Fondo General) en el ciclo elegido.
export function EnvelopeCard({ item, progress }) {
  const { line, opening, assigned, spent, balance, expected, paceDiff, perWeek, status } = item
  const isCurrent = progress.status === 'current'
  const isPast = progress.status === 'past'
  const pace = paceText(paceDiff)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{line.name}</p>
          <p className="text-xs text-muted">
            Gastado {money(spent)} de {money(assigned)}
            {opening !== 0 && <> · Arrastre {money(opening)}</>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">{isPast ? 'Cerró con' : 'Disponible'}</p>
          <p className={cn('text-lg font-bold tabular-nums', balance < 0 ? 'text-negative' : 'text-ink')}>
            {money(balance)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <PaceBar spent={spent} assigned={assigned} expected={expected} status={status} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
          {progress.status !== 'future' && <span className={pace.tone}>{pace.text}</span>}
          {isCurrent && balance > 0 && (
            <span className="text-muted">
              ≈ {money(perWeek)} por semana · {weeksText(progress.daysLeft)}
            </span>
          )}
          {isCurrent && balance < 0 && <span className="text-negative">Ya te pasaste de lo disponible</span>}
        </div>
      </div>
    </Card>
  )
}
