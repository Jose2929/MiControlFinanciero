import { Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { cn } from '../../lib/cn'
import { formatFullDate } from '../../lib/format'
import { KIND_META } from './calendarKinds'
import { money } from './money'

// Lo que pasa un día: cada evento con su palomita de "ya lo hice" (el corte no
// la lleva, no es algo que se haga), su concepto y su monto.
export function DayDetail({ year, month, day, events, checks, canToggle, onToggle }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">{formatFullDate(new Date(year, month, day))}</h3>

      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No hay nada programado este día.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {events.map((event) => {
            const { icon: Icon, tone } = KIND_META[event.kind]
            const done = event.checkable && checks[event.key] === true
            return (
              <li key={event.key} className="flex items-center gap-3 py-3">
                {event.checkable ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Marcar ${event.title}`}
                    disabled={!canToggle}
                    onClick={() => onToggle(event, !done)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50',
                      done ? 'border-positive bg-positive text-white' : 'border-line bg-surface2 hover:border-brand-400'
                    )}
                  >
                    {done && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                ) : (
                  <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                )}

                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface2', tone)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', done ? 'text-muted line-through' : 'text-ink')}>
                    {event.title}
                  </p>
                  {event.subtitle && <p className="text-xs text-muted">{event.subtitle}</p>}
                </div>

                {event.amount != null && (
                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      done ? 'text-muted' : event.kind === 'ingreso' ? 'text-positive' : 'text-ink'
                    )}
                  >
                    {event.kind === 'ingreso' && '+'}
                    {money(event.amount)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
