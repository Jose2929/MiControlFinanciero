import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/cn'
import { formatShortDate } from '../../lib/format'
import { money } from './money'

function Row({ label, detail, amount }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <p className={cn('shrink-0 text-sm font-semibold tabular-nums', amount < 0 ? 'text-negative' : 'text-ink')}>{money(amount)}</p>
    </li>
  )
}

// "Lo que tienes ahora": el saldo de los sobres del ciclo, separado en digital
// (débito y TDC2) y efectivo. Sin ciclo de arranque aún no hay saldos que mostrar.
//   available: summarizeAvailable(); cycle/progress: el ciclo que se muestra.
export function AvailableNowCard({ available, cycle, progress }) {
  if (!available) {
    return (
      <Card className="p-5">
        <p className="text-sm font-medium text-ink">Lo que tienes ahora</p>
        <p className="mt-1 text-sm text-muted">
          Todavía no eliges desde qué ciclo cuenta el presupuesto.{' '}
          <Link to="/presupuesto/sobres" className="font-medium text-brand-400 hover:text-brand-300">
            Elígelo en Sobres
          </Link>
          .
        </p>
      </Card>
    )
  }

  const started = progress.status !== 'future'
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Lo que tienes ahora</p>
          <p className={cn('mt-0.5 text-3xl font-bold tabular-nums', available.total < 0 ? 'text-negative' : 'text-ink')}>
            {money(available.total)}
          </p>
          <p className="text-xs text-muted">en sobres y bolsillos</p>
        </div>
        <Badge variant={started ? 'brand' : 'neutral'}>{started ? 'Ciclo en curso' : 'Aún no empieza'}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        Ciclo del {formatShortDate(cycle.start)} al {formatShortDate(cycle.end)}
      </p>

      <ul className="mt-2 divide-y divide-line">
        <Row
          label="Digital"
          detail={`Débito ${money(available.debito)} · Fondo general ${money(available.fondo)} · Bolsillos ${money(available.bolsillos)}`}
          amount={available.digital}
        />
        <Row label="Efectivo" detail="Lo que debe haber en tus sobres de efectivo" amount={available.efectivo} />
      </ul>

      <Link to="/presupuesto/sobres" className="mt-2 inline-block text-sm font-medium text-brand-400 hover:text-brand-300">
        Ver sobres
      </Link>
    </Card>
  )
}
