import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'
import { formatMoney } from '../../lib/format'

export function RegisterPaymentModal({ debt, onClose }) {
  const { accounts, registerDebtPayment } = useFinance()
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id)
  const [error, setError] = useState('')

  useEffect(() => {
    if (debt) {
      setAmount(String(debt.minPayment))
      setAccountId(accounts[0]?.id)
      setError('')
    }
  }, [debt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!debt) return null

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (value > debt.remainingBalance) {
      setError('El pago no puede ser mayor al saldo restante')
      return
    }
    registerDebtPayment(debt.id, value, accountId)
    onClose()
  }

  return (
    <Modal open={Boolean(debt)} onClose={onClose} title={`Registrar pago · ${debt.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface2 p-3.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>Saldo restante</span>
            <span className="font-semibold tabular-nums text-ink">{formatMoney(debt.remainingBalance)}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted">
            <span>Pago mínimo</span>
            <span className="font-semibold tabular-nums text-ink">{formatMoney(debt.minPayment)}</span>
          </div>
        </div>

        <Input
          label="Monto a pagar"
          type="number"
          min="0"
          max={debt.remainingBalance}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            if (error) setError('')
          }}
          error={error}
        />

        <Select label="Pagar desde" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <Button type="submit" size="lg" className="w-full">
          Confirmar pago
        </Button>
      </form>
    </Modal>
  )
}
