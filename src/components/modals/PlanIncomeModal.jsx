import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useBudget } from '../../context/BudgetContext'
import { MEDIO_LABELS, MEDIO_ORDER } from '../../lib/budget'
import { isValidDay } from '../../lib/budgetPlan'
import { cn } from '../../lib/cn'

// "15, 30" → [15, 30]; null si algún valor no es un día válido.
function parseDays(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0 || !parts.every(isValidDay)) return null
  return [...new Set(parts.map(Number))].sort((a, b) => a - b)
}

// mode: { type: 'create' } | { type: 'edit', income }
export function PlanIncomeModal({ mode, onClose }) {
  const { saveIncome, removeIncome } = useBudget()
  const isEdit = mode?.type === 'edit'

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [daysText, setDaysText] = useState('')
  const [covers, setCovers] = useState([])
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!mode) return
    setError('')
    setConfirmDelete(false)
    if (isEdit) {
      const i = mode.income
      setName(i.name)
      setAmount(String(i.amount))
      setDaysText(i.payDays.join(', '))
      setCovers(i.covers)
    } else {
      setName('')
      setAmount('')
      setDaysText('')
      setCovers([])
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function toggleCover(medio) {
    setCovers((prev) => (prev.includes(medio) ? prev.filter((m) => m !== medio) : [...prev, medio]))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Escribe un nombre.')
    if (!(Number(amount) > 0)) return setError('Escribe un monto mayor a 0.')
    const payDays = parseDays(daysText)
    if (!payDays) return setError('Escribe los días de pago, del 1 al 31, separados por coma. Ej. 15, 30')
    if (covers.length === 0) return setError('Elige qué medios cubre este ingreso.')
    saveIncome({
      id: isEdit ? mode.income.id : undefined,
      name: name.trim(),
      amount: Number(amount),
      payDays,
      covers,
    })
    onClose()
  }

  function handleDelete() {
    removeIncome(mode.income.id)
    onClose()
  }

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={isEdit ? 'Editar ingreso' : 'Agregar ingreso'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          placeholder="Ej. Sueldo"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto al mes"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError('')
            }}
          />
          <Input
            label="Días de pago"
            placeholder="15, 30"
            value={daysText}
            onChange={(e) => {
              setDaysText(e.target.value)
              setError('')
            }}
          />
        </div>
        <p className="-mt-2 text-xs text-muted">El monto mensual se divide en partes iguales entre los días de pago.</p>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink">Este ingreso cubre</span>
          <div className="flex flex-wrap gap-2">
            {MEDIO_ORDER.map((medio) => {
              const active = covers.includes(medio)
              return (
                <button
                  key={medio}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCover(medio)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-brand-400 bg-brand-500/10 text-brand-300'
                      : 'border-line bg-surface2 text-muted hover:text-ink'
                  )}
                >
                  {MEDIO_LABELS[medio]}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-xs font-medium text-negative">{error}</p>}

        <Button type="submit" size="lg" className="w-full">
          Guardar
        </Button>

        {isEdit &&
          (confirmDelete ? (
            <div className="rounded-xl border border-negative/40 bg-negative-soft p-3">
              <p className="text-sm font-medium text-ink">¿Quitar “{mode.income.name}” del plan?</p>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" variant="danger" onClick={handleDelete}>
                  Sí, quitar
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="w-full text-negative" onClick={() => setConfirmDelete(true)}>
              Eliminar ingreso
            </Button>
          ))}
      </form>
    </Modal>
  )
}
