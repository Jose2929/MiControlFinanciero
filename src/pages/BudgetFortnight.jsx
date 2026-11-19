import { ArrowLeftRight } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'

// Presupuesto › Quincena. Pantalla vacía por ahora (paso 2); aquí irán las
// transferencias del día 15 y del 30 con casillas para marcar las hechas.
export default function BudgetFortnight() {
  return (
    <Card className="p-5">
      <EmptyState
        icon={ArrowLeftRight}
        title="Plan por quincena"
        description="Aquí verás las transferencias del día 15 y del día 30, con casillas para marcar las que ya hiciste."
        action={<Badge variant="brand">En construcción</Badge>}
      />
    </Card>
  )
}
