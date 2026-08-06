import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'

// mode: { type: 'create' } | { type: 'edit', bill }
export function RecurringBillModal({ mode, onClose }) {
  const { allCategories, accounts, upsertRecurringBill } = useFinance()
  const isEdit = mode?.type === 'edit'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(allCategories[0]?.id)
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [accountId, setAccountId] = useState(accounts[0]?.id)

  useEffect(() => {
    if (!mode) return
    if (isEdit) {
      const b = mode.bill
      setName(b.name)
      setDescription(b.description || '')
      setCategoryId(b.categoryId)
      setEstimatedAmount(String(b.estimatedAmount))
      setDueDay(String(b.dueDay))
      setAccountId(b.accountId)
    } else {
      setName('')
      setDescription('')
      setCategoryId(allCategories[0]?.id)
      setEstimatedAmount('')
      setDueDay('1')
      setAccountId(accounts[0]?.id)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !Number(estimatedAmount)) return
    upsertRecurringBill({
      id: isEdit ? mode.bill.id : undefined,
      name: name.trim(),
      description: description.trim(),
      categoryId,
      estimatedAmount: Number(estimatedAmount),
      dueDay: Math.min(Math.max(Number(dueDay) || 1, 1), 31),
      accountId,
    })
    onClose()
  }

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={isEdit ? 'Editar gasto recurrente' : 'Agregar gasto recurrente'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre" placeholder="Ej. Streaming y membresías" value={name} onChange={(e) => setName(e.target.value)} required />

        <Textarea
          label="Descripción (opcional)"
          placeholder="Ej. Netflix $139 + HBO Max $119.50 = $258.50"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto estimado"
            type="number"
            min="0"
            value={estimatedAmount}
            onChange={(e) => setEstimatedAmount(e.target.value)}
            required
          />
          <Input
            label="Día de cobro"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        </div>

        <Select label="Cuenta habitual" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <Button type="submit" size="lg" className="w-full">
          Guardar
        </Button>
      </form>
    </Modal>
  )
}
