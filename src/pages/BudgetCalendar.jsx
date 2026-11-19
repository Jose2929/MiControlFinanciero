import { CalendarDays } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'

// Presupuesto › Calendario. Pantalla vacía por ahora (paso 2); aquí irán los
// próximos 30 días: sueldos, corte y pago de la TDC, cargos y ahorros.
export default function BudgetCalendar() {
  return (
    <Card className="p-5">
      <EmptyState
        icon={CalendarDays}
        title="Lo que viene"
        description="Aquí verás los próximos 30 días: sueldos, corte y pago de la TDC, cargos automáticos y ahorros programados."
        action={<Badge variant="brand">En construcción</Badge>}
      />
    </Card>
  )
}
