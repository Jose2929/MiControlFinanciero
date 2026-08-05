import { useState } from 'react'
import { Plus, Repeat } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { RecurringBillCard } from '../components/finance/RecurringBillCard'
import { RecurringBillModal } from '../components/modals/RecurringBillModal'
import { ConfirmRecurringPaymentModal } from '../components/modals/ConfirmRecurringPaymentModal'

export default function Recurring() {
  const { recurringStatus, findCategory, removeRecurringBill } = useFinance()
  const [modalMode, setModalMode] = useState(null)
  const [confirmingBill, setConfirmingBill] = useState(null)

  const pendingCount = recurringStatus.filter((b) => !b.confirmed).length

  return (
    <div className="space-y-5">
      <Card className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted">Pagos recurrentes</p>
          <p className="text-2xl font-bold text-ink">
            {pendingCount === 0 ? 'Todo confirmado este mes' : `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
          <Plus className="h-4 w-4" />
          Agregar recurrente
        </Button>
      </Card>

      {recurringStatus.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={Repeat}
            title="Sin gastos recurrentes configurados"
            description="Agrega tus pagos fijos (renta, servicios, suscripciones) para que te avisen cada mes y confirmes cuando se cobren."
            action={
              <Button size="sm" onClick={() => setModalMode({ type: 'create' })}>
                Agregar recurrente
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recurringStatus.map((status) => (
            <RecurringBillCard
              key={status.id}
              status={status}
              category={findCategory(status.categoryId)}
              onConfirm={setConfirmingBill}
              onEdit={(bill) => setModalMode({ type: 'edit', bill })}
              onRemove={removeRecurringBill}
            />
          ))}
        </div>
      )}

      <RecurringBillModal mode={modalMode} onClose={() => setModalMode(null)} />
      <ConfirmRecurringPaymentModal bill={confirmingBill} onClose={() => setConfirmingBill(null)} />
    </div>
  )
}
