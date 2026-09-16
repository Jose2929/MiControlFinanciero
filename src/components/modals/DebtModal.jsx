import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { AddCategoryForm } from '../finance/AddCategoryForm'
import { useFinance } from '../../context/FinanceContext'
import { parseDateInputValue, toDateInputValue } from '../../lib/format'

// Solo edición — no se piden altas nuevas de deuda desde aquí.
export function DebtModal({ debt, onClose }) {
  const { allCategories, addCategory, updateDebt } = useFinance()
  const isMsi = debt?.kind === 'msi'

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingBalance, setRemainingBalance] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [cutDate, setCutDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [installments, setInstallments] = useState('')
  const [installmentsPaid, setInstallmentsPaid] = useState('')

  useEffect(() => {
    if (!debt) return
    setName(debt.name || '')
    setType(debt.type || '')
    setCategoryId(debt.categoryId || allCategories[0]?.id || '')
    setAddingCategory(false)
    setTotalAmount(String(debt.totalAmount ?? ''))
    setRemainingBalance(String(debt.remainingBalance ?? ''))
    setInterestRate(String(debt.interestRate ?? ''))
    setMinPayment(String(debt.minPayment ?? ''))
    setCutDate(toDateInputValue(debt.cutDate))
    setDueDate(toDateInputValue(debt.dueDate))
    setInstallments(String(debt.installments ?? ''))
    setInstallmentsPaid(String(debt.installmentsPaid ?? ''))
  }, [debt])

  if (!debt) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    // Un campo vacío conserva el valor anterior (en vez de guardarse como 0)
    // — antes, limpiar por error "Saldo restante" marcaba la deuda como
    // pagada. Un "0" explícito sí se respeta (p.ej. tasa de interés en 0%).
    const nextTotalAmount = totalAmount === '' ? debt.totalAmount : Number(totalAmount) || 0
    const nextRemainingBalance = remainingBalance === '' ? debt.remainingBalance : Number(remainingBalance) || 0
    updateDebt(debt.id, {
      name: name.trim(),
      type: type.trim(),
      categoryId: categoryId || null,
      totalAmount: nextTotalAmount,
      // El saldo restante nunca puede superar el monto total.
      remainingBalance: Math.min(nextRemainingBalance, nextTotalAmount),
      interestRate: interestRate === '' ? debt.interestRate : Number(interestRate) || 0,
      minPayment: minPayment === '' ? debt.minPayment : Number(minPayment) || 0,
      cutDate: cutDate ? parseDateInputValue(cutDate) : debt.cutDate,
      dueDate: dueDate ? parseDateInputValue(dueDate) : debt.dueDate,
      ...(isMsi && {
        installments: Number(installments) || debt.installments,
        installmentsPaid: Number(installmentsPaid) || 0,
      }),
    })
    onClose()
  }

  return (
    <Modal open={Boolean(debt)} onClose={onClose} title={`Editar deuda · ${debt.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Tipo"
          placeholder="Ej. Tarjeta de crédito"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />

        <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        {addingCategory ? (
          <AddCategoryForm
            onAdd={(cat) => {
              const created = addCategory(cat)
              setCategoryId(created.id)
              setAddingCategory(false)
            }}
            onCancel={() => setAddingCategory(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva categoría
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto total"
            type="number"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
          <Input
            label="Saldo restante"
            type="number"
            min="0"
            value={remainingBalance}
            onChange={(e) => setRemainingBalance(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={isMsi ? 'Tasa mensual %' : 'Tasa anual %'}
            type="number"
            min="0"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
          />
          <Input
            label="Pago mínimo"
            type="number"
            min="0"
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha de corte" type="date" value={cutDate} onChange={(e) => setCutDate(e.target.value)} />
          <Input label="Fecha límite" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {isMsi && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cuotas totales"
              type="number"
              min="1"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
            <Input
              label="Cuotas pagadas"
              type="number"
              min="0"
              value={installmentsPaid}
              onChange={(e) => setInstallmentsPaid(e.target.value)}
            />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full">
          Guardar cambios
        </Button>
      </form>
    </Modal>
  )
}
