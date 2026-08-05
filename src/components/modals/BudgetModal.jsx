import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'

// mode: { type: 'create' } | { type: 'edit', budget }
export function BudgetModal({ mode, onClose }) {
  const { allCategories, budgets, upsertBudget } = useFinance()
  const isEdit = mode?.type === 'edit'
  const availableCategories = allCategories.filter(
    (c) => isEdit || !budgets.some((b) => b.categoryId === c.id)
  )

  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  useEffect(() => {
    if (!mode) return
    if (isEdit) {
      setCategoryId(mode.budget.categoryId)
      setLimit(String(mode.budget.limit))
    } else {
      setCategoryId(availableCategories[0]?.id || '')
      setLimit('')
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!categoryId || !limit) return
    upsertBudget(categoryId, limit)
    onClose()
  }

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={isEdit ? 'Editar presupuesto' : 'Crear presupuesto'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Categoría"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={isEdit}
        >
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        <Input
          label="Límite mensual"
          type="number"
          min="0"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          required
        />

        <Button type="submit" size="lg" className="w-full">
          Guardar presupuesto
        </Button>
      </form>
    </Modal>
  )
}
