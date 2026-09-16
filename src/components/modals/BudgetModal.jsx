import { useEffect, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { AddCategoryForm } from '../finance/AddCategoryForm'
import { useFinance } from '../../context/FinanceContext'

// mode: { type: 'create' } | { type: 'edit', budget }
export function BudgetModal({ mode, onClose }) {
  const { allCategories, budgets, upsertBudget, removeBudget, addCategory } = useFinance()
  const isEdit = mode?.type === 'edit'
  const availableCategories = allCategories.filter(
    (c) => isEdit || !budgets.some((b) => b.categoryId === c.id)
  )
  const noAvailableCategories = !isEdit && availableCategories.length === 0

  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')

  function applyAdjust(sign) {
    const delta = Number(adjustAmount) || 0
    if (!delta) return
    setLimit((prev) => String(Math.max((Number(prev) || 0) + sign * delta, 0)))
    setAdjustAmount('')
  }

  useEffect(() => {
    if (!mode) return
    setAdjustAmount('')
    if (isEdit) {
      setAddingCategory(false)
      setCategoryId(mode.budget.categoryId)
      setLimit(String(mode.budget.limit))
    } else {
      setAddingCategory(availableCategories.length === 0)
      setCategoryId(availableCategories[0]?.id || '')
      setLimit('')
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function handleSubmit(e) {
    e.preventDefault()
    // "!limit" no bastaba: el string "0" es verdadero en JS, así que un
    // límite de $0 pasaba la validación.
    if (!categoryId || !(Number(limit) > 0)) return
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
        {noAvailableCategories ? (
          <p className="text-xs text-muted">
            Ya tienes presupuesto para todas tus categorías. Crea una nueva para agregar más:
          </p>
        ) : (
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
        )}

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

        {isEdit && (
          <div className="flex items-end gap-2">
            <Input
              label="Ajustar por"
              type="number"
              min="0"
              placeholder="Cantidad"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              containerClassName="flex-1"
            />
            <Button type="button" variant="secondary" onClick={() => applyAdjust(-1)} aria-label="Restar al límite">
              <Minus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" onClick={() => applyAdjust(1)} aria-label="Sumar al límite">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

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
