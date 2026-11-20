import { Pencil, Plus } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { MEDIO_DESCRIPTIONS, MEDIO_LABELS, annualContribution, sumLines, targetPerPayment } from '../../lib/budget'
import { FREQUENCY_LABELS, money } from './money'

function lineSubtitle(line) {
  if (line.kind === 'fondo') return 'Fondo general · sin cobro propio'
  if (line.kind === 'bolsillo') {
    const parts = [FREQUENCY_LABELS[line.payFrequency], `${money(annualContribution(line))} al año`]
    const target = targetPerPayment(line)
    if (line.payFrequency === 'semestral' && target != null) parts.push(`cobro de ${money(target)}`)
    return parts.join(' · ')
  }
  if (line.kind === 'cargo') return line.payDay ? `Cargo el día ${line.payDay}` : 'Sin día definido'
  return line.payDay ? `Día ${line.payDay}` : null
}

// Un medio (TDC, TDC2, Débito, Efectivo, Ahorro) con sus renglones y subtotal.
export function MedioCard({ medio, lines, onAdd, onEdit }) {
  const subtotal = sumLines(lines)
  const pocketsPerYear =
    medio === 'tdc2'
      ? sumLines(lines.filter((l) => l.kind === 'bolsillo').map((l) => ({ amount: annualContribution(l) })))
      : 0

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{MEDIO_LABELS[medio]}</h3>
          <p className="text-xs text-muted">{MEDIO_DESCRIPTIONS[medio]}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">Subtotal</p>
          <p className="text-sm font-semibold tabular-nums text-ink">{money(subtotal)}</p>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">Aún no hay renglones en este medio.</p>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {lines.map((line) => {
            const subtitle = lineSubtitle(line)
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => onEdit(line)}
                aria-label={`Editar ${line.name}`}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-surface2/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                    {line.isValve && (
                      <Badge variant="warning" className="shrink-0">
                        Válvula
                      </Badge>
                    )}
                  </div>
                  {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(line.amount)}</span>
                <Pencil className="h-4 w-4 shrink-0 text-muted" />
              </button>
            )
          })}
        </div>
      )}

      {pocketsPerYear > 0 && (
        <p className="mt-2 border-t border-line px-1 pt-3 text-xs text-muted">
          Entre todos los bolsillos juntas {money(pocketsPerYear)} al año.
        </p>
      )}

      <button
        type="button"
        onClick={() => onAdd(medio)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2.5 text-sm font-medium text-brand-400 transition-colors hover:bg-surface2/60 hover:text-brand-300"
      >
        <Plus className="h-4 w-4" />
        Agregar a {MEDIO_LABELS[medio]}
      </button>
    </Card>
  )
}
