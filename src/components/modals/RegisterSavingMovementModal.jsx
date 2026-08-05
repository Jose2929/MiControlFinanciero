import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useFinance } from '../../context/FinanceContext'
import { formatMoney } from '../../lib/format'

export function RegisterSavingMovementModal({ account, onClose }) {
  const { accounts, registerSavingMovement } = useFinance()
  const [direction, setDirection] = useState('deposito')
  const [amount, setAmount] = useState('')
  const [counterAccountId, setCounterAccountId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  // Cuentas que pueden ser la contraparte: cualquier débito/efectivo/ahorro,
  // excepto la propia cuenta de ahorro que se está moviendo. Las de crédito
  // se excluyen — pagar hacia/desde una tarjeta de crédito con esta acción no
  // aplica en este modelo (para deudas ya existe "Registrar pago").
  const counterOptions = accounts.filter((a) => a.id !== account?.id && a.type !== 'credito')

  useEffect(() => {
    if (account) {
      setDirection('deposito')
      setAmount('')
      setCounterAccountId(counterOptions[0]?.id || '')
      setNote('')
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  if (!account) return null

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (direction === 'retiro' && value > account.balance) {
      setError('No puedes retirar más de lo que tienes ahorrado')
      return
    }
    registerSavingMovement({
      accountId: account.id,
      counterAccountId: counterAccountId || null,
      amount: value,
      direction,
      note,
    })
    onClose()
  }

  return (
    <Modal open={Boolean(account)} onClose={onClose} title={`Movimiento · ${account.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface2 p-3.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>Ahorrado actualmente</span>
            <span className="font-semibold tabular-nums text-ink">{formatMoney(account.balance)}</span>
          </div>
          {account.goal > 0 && (
            <div className="mt-1 flex justify-between text-muted">
              <span>Meta</span>
              <span className="font-semibold tabular-nums text-ink">{formatMoney(account.goal)}</span>
            </div>
          )}
        </div>

        <SegmentedTabs
          className="w-full"
          tabs={[
            { value: 'deposito', label: 'Depositar' },
            { value: 'retiro', label: 'Retirar' },
          ]}
          value={direction}
          onChange={setDirection}
        />

        <Input
          label="Monto"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            if (error) setError('')
          }}
          error={error}
        />

        <Select
          label={direction === 'retiro' ? 'Depositar en' : 'Sale de'}
          value={counterAccountId}
          onChange={(e) => setCounterAccountId(e.target.value)}
        >
          <option value="">Sin cuenta contraparte (efectivo, no rastreado)</option>
          {counterOptions.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <Input
          label="Nota (opcional)"
          placeholder={direction === 'retiro' ? 'Ej. Emergencia auto' : 'Ej. Ahorro del mes'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button type="submit" size="lg" className="w-full">
          {direction === 'retiro' ? 'Confirmar retiro' : 'Confirmar depósito'}
        </Button>
      </form>
    </Modal>
  )
}
