import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { getCycleForDate, shiftCycle } from '../../lib/budget'
import { formatShortDate } from '../../lib/format'

const label = (cycle) => `${formatShortDate(cycle.start)} – ${formatShortDate(cycle.end)}`

// Primer uso de Sobres: elegir desde qué ciclo cuenta el presupuesto. Sin esto
// no hay dónde "arrancar en $0".
export function StartCycleCard({ cycleStartDay, onChoose }) {
  const current = getCycleForDate(new Date(), cycleStartDay)
  const next = shiftCycle(current, 1)

  return (
    <Card className="space-y-3 p-5">
      <Badge variant="brand">Un paso antes de empezar</Badge>
      <p className="text-base font-semibold text-ink">¿Desde qué ciclo cuenta el presupuesto?</p>
      <p className="text-sm text-muted">
        Los sobres arrancan en $0 en ese ciclo y acumulan hacia adelante lo que sobre. Los gastos de antes no cuentan.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => onChoose(current.key)}>
          Empezar en el ciclo actual ({label(current)})
        </Button>
        <Button type="button" variant="secondary" onClick={() => onChoose(next.key)}>
          Empezar en el siguiente ({label(next)})
        </Button>
      </div>
      <p className="text-xs text-muted">Lo puedes cambiar después en Plan → Fechas y ciclo.</p>
    </Card>
  )
}
