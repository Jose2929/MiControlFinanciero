import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { AccountCard } from '../components/finance/AccountCard'
import { Button } from '../components/ui/Button'
import { AddAccountModal } from '../components/modals/AddAccountModal'

export default function Accounts() {
  const { accounts } = useFinance()
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{accounts.length} cuentas registradas</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar cuenta
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div key={account.id} className="animate-fade-in-up">
            <AccountCard account={account} />
          </div>
        ))}
      </div>

      <AddAccountModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
