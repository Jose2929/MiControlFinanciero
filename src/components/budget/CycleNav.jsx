import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatShortDate } from '../../lib/format'

// Selector de ciclo: ‹ 1 nov – 30 nov ›. Solo se puede ir del ciclo de
// arranque al de hoy.
export function CycleNav({ cycle, progress, canPrev, canNext, onPrev, onNext }) {
  const isCurrent = progress.status === 'current'
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Ciclo anterior"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="min-w-0 text-center">
        <p className="text-sm font-semibold text-ink">
          {formatShortDate(cycle.start)} – {formatShortDate(cycle.end)}
        </p>
        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-muted">
          {isCurrent && <span>Día {progress.dayNumber} de {progress.totalDays}</span>}
          {progress.status === 'past' && <Badge variant="neutral">Ciclo anterior</Badge>}
          {progress.status === 'future' && <Badge variant="neutral">Aún no empieza</Badge>}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Ciclo siguiente"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
