import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { dayStatus, daysInMonth, kindsOfDay } from '../../lib/budgetCalendar'
import { KIND_META } from './calendarKinds'

// Domingo primero, como los calendarios de México.
const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

// Cuadrícula del mes. Cada día muestra un icono por tipo de evento (con un
// número si hay varios del mismo tipo); un icono atenuado quiere decir que ya
// se marcó todo de ese tipo, y la palomita de la esquina, que el día está listo.
//
//   byDay:       { [día]: eventos }          checks: { [clave]: true } del mes
//   selectedDay: día elegido                 todayDay: día de hoy si es este mes
export function CalendarGrid({ year, month, byDay, checks, selectedDay, todayDay, onSelect }) {
  const monthText = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(year, month, 1))
  const blanks = new Date(year, month, 1).getDay()
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted" aria-hidden="true">
        {WEEKDAYS.map((letter, i) => (
          <span key={i}>{letter}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}

        {days.map((day) => {
          const events = byDay[day] || []
          const kinds = kindsOfDay(events, checks)
          const status = dayStatus(events, checks)
          const selected = day === selectedDay
          const isToday = day === todayDay
          const summary = kinds.map(({ kind }) => KIND_META[kind].label).join(', ')
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${day} de ${monthText}${summary ? `: ${summary}` : ''}${status === 'done' ? ' (todo marcado)' : ''}`}
              className={cn(
                'relative flex min-h-[4rem] flex-col items-start rounded-lg border p-1 text-left transition-colors',
                selected ? 'border-brand-400 bg-brand-500/10' : 'border-line bg-surface hover:bg-surface2',
                isToday && !selected && 'border-brand-400/50'
              )}
            >
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
                  isToday ? 'brand-gradient text-white' : 'text-ink'
                )}
              >
                {day}
              </span>
              {kinds.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-x-1 gap-y-0.5 pt-1">
                  {kinds.map(({ kind, count, done }) => {
                    const { icon: Icon, tone } = KIND_META[kind]
                    return (
                      <span key={kind} className={cn('inline-flex items-center', tone, done && 'opacity-35')}>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {count > 1 && <span className="ml-px text-[9px] font-bold leading-none">{count}</span>}
                      </span>
                    )
                  })}
                </span>
              )}
              {status === 'done' && (
                <Check className="absolute right-1 top-1 h-3 w-3 text-positive" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
