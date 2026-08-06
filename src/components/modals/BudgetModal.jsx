import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { AddCategoryForm } from '../finance/AddCategoryForm'
import { useFinance } from '../../context/FinanceContext'

// mode: { type: 'create' } | { type: 'edit', budget }
export function BudgetModal({ mode, onClose }) {
  const { budgetableCategories, budgets, upsertBudget, removeBudget, addCategory } = useFinance()
  const isEdit = mode?.type === 'edit'
  const availableCategories = budgetableCategories.filter(
    (c) => isEdit || !budgets.some((b) => b.categoryId === c.id)
  )

  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  useEffect(() => {
    if (!mode) return
    setAddingCategory(false)
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

  function handleRemove() {
    removeBudget(mode.budget.categoryId)
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

        {!isEdit &&
          (addingCategory ? (
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
          ))}

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

        {isEdit && (
          <Button type="button" variant="ghost" size="lg" className="w-full text-negative" onClick={handleRemove}>
            Eliminar presupuesto
          </Button>
        )}
      </form>
    </Modal>
  )
}
