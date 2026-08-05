import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function ConfirmRecurringPaymentModal({ bill, onClose }) {
  const { accounts, confirmRecurringPayment } = useFinance()
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id)
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    if (bill) {
      setAmount(String(bill.estimatedAmount))
      setAccountId(bill.accountId || accounts[0]?.id)
      setDate(todayISO())
    }
  }, [bill]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bill) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!Number(amount)) return
    confirmRecurringPayment(bill.id, { amount: Number(amount), accountId, date })
    onClose()
  }

  return (
    <Modal open={Boolean(bill)} onClose={onClose} title={`Confirmar pago · ${bill.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          Confirma el monto que realmente se cobró este mes. Se registrará como gasto y afectará tu presupuesto.
        </p>

        <Input label="Monto cobrado" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />

        <Select label="Cuenta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <Input label="Fecha de cobro" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

        <Button type="submit" size="lg" className="w-full">
          Confirmar pago
        </Button>
      </form>
    </Modal>
  )
}
