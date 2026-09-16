import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useFinance } from '../../context/FinanceContext'

export function AdjustBalanceModal({ open, onClose }) {
  const { accounts, addBalanceAdjustment } = useFinance()
  const adjustableAccounts = accounts.filter((a) => a.type !== 'credito')

  const [accountId, setAccountId] = useState(adjustableAccounts[0]?.id || '')
  const [direction, setDirection] = useState('increase')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [accountError, setAccountError] = useState('')

  function reset() {
    setAccountId(adjustableAccounts[0]?.id || '')
    setDirection('increase')
    setAmount('')
    setNote('')
    setError('')
    setAccountError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!accountId) {
      setAccountError('Elige una cuenta')
      return
    }
    if (!value || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    addBalanceAdjustment({ accountId, amount: value, direction, note })
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Ajustar saldo">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted">
          Corrige cuánto dinero tienes en una cuenta ahora mismo — útil para arrancar a medio mes cuando el
          ingreso ya llegó y en parte ya se gastó, sin tener que registrar cada transacción pasada.
        </p>

        <Select
          label="Cuenta"
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value)
            if (accountError) setAccountError('')
          }}
        >
          {adjustableAccounts.length === 0 && <option value="">No tienes cuentas ajustables</option>}
          {adjustableAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>
        {accountError && <p className="-mt-2 text-xs text-negative">{accountError}</p>}

        <SegmentedTabs
          className="w-full"
          tabs={[
            { value: 'increase', label: 'Aumentar' },
            { value: 'decrease', label: 'Reducir' },
          ]}
          value={direction}
          onChange={setDirection}
        />

        <Input
          label="Monto del ajuste"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            if (error) setError('')
          }}
          error={error}
        />

        <Input
          label="Nota"
          placeholder="Ej. Ingreso de agosto ya recibido y en parte gastado"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button type="submit" size="lg" className="w-full">
          Guardar ajuste
        </Button>
      </form>
    </Modal>
  )
}
