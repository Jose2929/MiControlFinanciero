import { Wallet } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'

// Presupuesto › Sobres. Pantalla vacía por ahora (paso 2); aquí irán el saldo
// de cada sobre, el ritmo de gasto del ciclo y el aproximado por semana.
export default function BudgetEnvelopes() {
  return (
    <Card className="p-5">
      <EmptyState
        icon={Wallet}
        title="Sobres de gasto"
        description="Aquí verás el saldo de cada sobre, cuánto llevas gastado frente al ritmo esperado del ciclo y un aproximado por semana."
        action={<Badge variant="brand">En construcción</Badge>}
      />
    </Card>
  )
}
