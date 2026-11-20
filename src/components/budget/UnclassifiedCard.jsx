import { Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { formatShortDate } from '../../lib/format'
import { money } from './money'

const MAX_SHOWN = 20

// Gastos del ciclo que aún no tienen sobre. Se asignan de un toque; si hay una
// sugerencia (historial o nombre) viene lista, pero nunca se aplica sola.
export function UnclassifiedCard({ items, accountNames, categoryLabel, onAssign, onAssignSuggested }) {
  if (items.length === 0) return null
  const shown = items.slice(0, MAX_SHOWN)
  const suggested = items.filter((i) => i.suggestion)

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-[14rem] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Gastos sin sobre</h3>
            <Badge variant="warning">{items.length}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Asígnalos para que cuenten en su sobre. Mientras no tengan sobre, los saldos de arriba no los descuentan.
          </p>
        </div>
        {suggested.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 whitespace-nowrap"
            onClick={() => onAssignSuggested(suggested)}
          >
            <Sparkles className="h-4 w-4" />
            Usar sugeridos ({suggested.length})
          </Button>
        )}
      </div>

      <div className="mt-2 divide-y divide-line">
        {shown.map(({ transaction: t, options, suggestion }) => {
          const title = t.note || categoryLabel(t.categoryId) || 'Gasto'
          const suggestedLine = suggestion ? options.find((l) => l.id === suggestion.lineId) : null
          return (
            <div key={t.id} className="px-1 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{title}</p>
                  <p className="truncate text-xs text-muted">
                    {[formatShortDate(t.date), categoryLabel(t.categoryId), accountNames[t.accountId]]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(t.amount)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Select
                  aria-label={`Sobre para ${title}`}
                  containerClassName="min-w-0 flex-1"
                  value=""
                  onChange={(e) => e.target.value && onAssign(t.id, e.target.value)}
                >
                  <option value="">Elegir sobre…</option>
                  {options.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.name}
                    </option>
                  ))}
                </Select>
                {suggestedLine && (
                  <Button
                    type="button"
                    size="md"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => onAssign(t.id, suggestedLine.id)}
                  >
                    Usar {suggestedLine.name}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {items.length > shown.length && (
        <p className="border-t border-line px-1 pt-3 text-xs text-muted">
          Mostrando {shown.length} de {items.length}. Al asignar estos, aparecen los demás.
        </p>
      )}
    </Card>
  )
}
