import { SlidersHorizontal } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'

// Presupuesto › Plan. Pantalla vacía por ahora (paso 2); aquí irá la tabla
// editable agrupada por medio, con la verificación de que cuadra.
export default function BudgetPlan() {
  return (
    <Card className="p-5">
      <EmptyState
        icon={SlidersHorizontal}
        title="Plan del presupuesto"
        description="Aquí podrás editar ingresos, fechas y la tabla completa, con la verificación de que cuadra."
        action={<Badge variant="brand">En construcción</Badge>}
      />
    </Card>
  )
}
