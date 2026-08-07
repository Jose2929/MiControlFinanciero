import { HandCoins, Wifi } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import { MoneyText } from '../finance/MoneyText'
import { useFinance } from '../../context/FinanceContext'
import { formatMoney } from '../../lib/format'

export function DebtBreakdownModal({ open, onClose }) {
  const { debts, accounts, totalDebt } = useFinance()
  const pendingDebts = debts.filter((d) => d.remainingBalance > 0)
  const usedCards = accounts.filter((a) => a.type === 'credito' && a.used > 0)
  const isEmpty = pendingDebts.length === 0 && usedCards.length === 0

  return (
    <Modal open={open} onClose={onClose} title="Deuda total pendiente">
      {isEmpty ? (
        <EmptyState
          icon={HandCoins}
          title="Sin deudas pendientes"
          description="No tienes deudas ni saldo usado en tarjetas de crédito."
        />
      ) : (
        <div className="space-y-1">
          <div className="divide-y divide-line">
            {pendingDebts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                  <HandCoins className="h-4.5 w-4.5" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{d.name}</p>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {formatMoney(d.remainingBalance)}
                </span>
              </div>
            ))}
            {usedCards.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                  <Wifi className="h-4.5 w-4.5 rotate-90" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{a.name}</p>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {formatMoney(a.used)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <p className="text-sm font-semibold text-ink">Total</p>
            <MoneyText amount={totalDebt} variant="negative" className="text-sm font-bold" />
          </div>
        </div>
      )}
    </Modal>
  )
}
