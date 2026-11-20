import { ChevronDown } from 'lucide-react'
import { Card } from '../ui/Card'
import { formatPercent } from '../../lib/format'
import { money } from './money'

// Un bloque del plan ("Sobres de Débito", "Tarjeta de crédito"…): se ve su
// total y su parte del mes; al tocarlo se despliega cada renglón con su monto.
export function OverviewSection({ section }) {
  const noun = section.count === 1 ? section.noun[0] : section.noun[1]
  return (
    <Card className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{section.title}</p>
            <p className="text-xs text-muted">
              {section.count} {noun} · {formatPercent(section.share)} del mes
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(section.total)}</p>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-line px-4 pb-1">
          <p className="pt-3 text-xs text-muted">{section.hint}</p>
          <ul className="divide-y divide-line">
            {section.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{line.name}</p>
                  {line.detail && <p className="text-xs text-muted">{line.detail}</p>}
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums text-ink">{money(line.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </Card>
  )
}
