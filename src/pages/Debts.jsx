import { useMemo, useState } from 'react'
import { HandCoins } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { SegmentedTabs } from '../components/ui/SegmentedTabs'
import { DebtCard } from '../components/finance/DebtCard'
import { MoneyText } from '../components/finance/MoneyText'
import { RegisterPaymentModal } from '../components/modals/RegisterPaymentModal'
import { DebtModal } from '../components/modals/DebtModal'

export default function Debts() {
  const { upcomingPayments, totalDebt } = useFinance()
  const [selectedDebt, setSelectedDebt] = useState(null)
  const [editingDebt, setEditingDebt] = useState(null)
  const [tab, setTab] = useState('all')

  const filtered = useMemo(() => {
    if (tab === 'debt') return upcomingPayments.filter((d) => d.kind !== 'msi')
    if (tab === 'msi') return upcomingPayments.filter((d) => d.kind === 'msi')
    return upcomingPayments
  }, [upcomingPayments, tab])

  return (
    <div className="space-y-5">
      <Card className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted">Deuda total pendiente</p>
          <p className="text-2xl font-bold">
            <MoneyText amount={totalDebt} variant="neutral" />
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <HandCoins className="h-5 w-5" />
        </span>
      </Card>

      <SegmentedTabs
        tabs={[
          { value: 'all', label: 'Todas' },
          { value: 'debt', label: 'Deudas' },
          { value: 'msi', label: 'Meses sin intereses' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {filtered.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={HandCoins}
            title="Sin resultados"
            description="No hay deudas en esta categoría por el momento."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((debt) => (
            <DebtCard key={debt.id} debt={debt} onRegisterPayment={setSelectedDebt} onEdit={setEditingDebt} />
          ))}
        </div>
      )}

      <RegisterPaymentModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} />
      <DebtModal debt={editingDebt} onClose={() => setEditingDebt(null)} />
    </div>
  )
}
