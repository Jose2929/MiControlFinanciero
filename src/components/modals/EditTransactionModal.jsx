import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'
import { useBudget } from '../../context/BudgetContext'
import { envelopeOptions, getAccountMedio, ruleEnvelopeFor } from '../../lib/budgetEnvelopes'
import { toDateInputValue } from '../../lib/format'

// Edita o elimina una transacción ya registrada — gasto normal o pago de
// deuda. Las transacciones convertidas a MSI no pasan por aquí (no se
// renderiza el botón que abre este modal para esas filas).
export function EditTransactionModal({ transaction, onClose }) {
  const { allCategories, accounts, updateTransaction, deleteTransaction } = useFinance()
  const { plan, status: budgetStatus } = useBudget()
  const isDebtPayment = transaction?.type === 'debt_payment'

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [envelopeId, setEnvelopeId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  const category = allCategories.find((c) => c.id === categoryId)

  // Sobre del presupuesto: solo en gastos reales (no pagos de deuda ni de
  // tarjeta) con una cuenta ligada a un medio. Si el selector no se muestra,
  // el gasto conserva el sobre que ya tenía.
  const envelopeChoices = useMemo(
    () =>
      budgetStatus === 'ready' && !isDebtPayment && !transaction?.counterAccountId
        ? envelopeOptions(plan, accountId)
        : [],
    [budgetStatus, plan, accountId, isDebtPayment, transaction?.counterAccountId]
  )
  const showEnvelope = envelopeChoices.length > 0
  // Un sobre que no es de este medio (p. ej. al cambiar de cuenta) no aplica.
  const selectedEnvelope = envelopeChoices.some((line) => line.id === envelopeId) ? envelopeId : ''
  // Sin sobre elegido a mano, el gasto resta del sobre ligado a su categoría
  // (si lo hay) — se dice en la primera opción para que no sorprenda.
  const ruledLine = showEnvelope
    ? envelopeChoices.find((line) => line.id === ruleEnvelopeFor(plan, getAccountMedio(plan, accountId), categoryId))
    : null

  useEffect(() => {
    if (!transaction) return
    setAmount(String(transaction.amount ?? ''))
    setCategoryId(transaction.categoryId || allCategories[0]?.id || '')
    setSubcategoryId(transaction.subcategoryId || '')
    setAccountId(transaction.accountId || accounts[0]?.id || '')
    setEnvelopeId(transaction.envelopeId || '')
    setNote(transaction.note || '')
    setDate(toDateInputValue(transaction.date))
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction])

  if (!transaction) return null

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    updateTransaction(transaction.id, {
      amount: value,
      categoryId: categoryId || null,
      ...(!isDebtPayment && { subcategoryId: subcategoryId || null }),
      ...(showEnvelope && { envelopeId: selectedEnvelope || null }),
      accountId,
      note: note.trim(),
      date,
    })
    onClose()
  }

  function handleDelete() {
    deleteTransaction(transaction.id)
    onClose()
  }

  return (
    <Modal
      open={Boolean(transaction)}
      onClose={onClose}
      title={isDebtPayment ? 'Editar pago de deuda' : 'Editar gasto'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          required
        />

        <Select
          label="Categoría"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setSubcategoryId('')
          }}
        >
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        {!isDebtPayment && category?.subcategories?.length > 0 && (
          <Select label="Subcategoría" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">General</option>
            {category.subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.label}
              </option>
            ))}
          </Select>
        )}

        <Select label="Cuenta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        {showEnvelope && (
          <Select
            label="Sobre del presupuesto (opcional)"
            value={selectedEnvelope}
            onChange={(e) => setEnvelopeId(e.target.value)}
          >
            <option value="">{ruledLine ? `Según la categoría (${ruledLine.name})` : 'Sin sobre'}</option>
            {envelopeChoices.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={date} max={toDateInputValue(new Date())} onChange={(e) => setDate(e.target.value)} />
          <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Guardar cambios
        </Button>

        <Button type="button" variant="ghost" size="lg" className="w-full text-negative" onClick={handleDelete}>
          Eliminar
        </Button>
      </form>
    </Modal>
  )
}
