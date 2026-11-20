import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Toggle } from '../ui/Toggle'
import { useBudget } from '../../context/BudgetContext'
import { MEDIO_LABELS, MEDIO_ORDER } from '../../lib/budget'
import { isValidDay } from '../../lib/budgetPlan'
import { money } from '../budget/money'

// mode: { type: 'create', medio } | { type: 'edit', line }
export function PlanLineModal({ mode, onClose }) {
  const { saveLine, removeLine } = useBudget()
  const isEdit = mode?.type === 'edit'

  const [name, setName] = useState('')
  const [medio, setMedio] = useState('tdc')
  const [amount, setAmount] = useState('')
  const [payDay, setPayDay] = useState('')
  const [payFrequency, setPayFrequency] = useState('anual') // '' = fondo general (solo TDC2)
  const [isValve, setIsValve] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!mode) return
    setError('')
    setConfirmDelete(false)
    if (isEdit) {
      const l = mode.line
      setName(l.name)
      setMedio(l.medio)
      setAmount(String(l.amount))
      setPayDay(l.payDay ? String(l.payDay) : '')
      setPayFrequency(l.payFrequency || '')
      setIsValve(l.isValve)
    } else {
      setName('')
      setMedio(mode.medio || 'tdc')
      setAmount('')
      setPayDay('')
      setPayFrequency('anual')
      setIsValve(false)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Escribe un nombre.')
    if (!(Number(amount) > 0)) return setError('Escribe un monto mayor a 0.')
    if (payDay !== '' && !isValidDay(payDay)) return setError('El día debe ser un entero del 1 al 31.')
    saveLine({
      id: isEdit ? mode.line.id : undefined,
      order: isEdit ? mode.line.order : undefined,
      name: name.trim(),
      medio,
      amount: Number(amount),
      payDay: payDay === '' ? null : Number(payDay),
      payFrequency: medio === 'tdc2' ? payFrequency || null : 'mensual',
      isValve: medio === 'tdc' ? isValve : false,
    })
    onClose()
  }

  function handleDelete() {
    removeLine(mode.line.id)
    onClose()
  }

  const perYear = Number(amount) > 0 ? Number(amount) * 12 : 0

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={isEdit ? 'Editar renglón' : 'Agregar renglón'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          placeholder="Ej. Netflix"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
        />

        <Select label="Medio" value={medio} onChange={(e) => setMedio(e.target.value)}>
          {MEDIO_ORDER.map((m) => (
            <option key={m} value={m}>
              {MEDIO_LABELS[m]}
            </option>
          ))}
        </Select>

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
            label="Día del mes (opcional)"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={payDay}
            onChange={(e) => {
              setPayDay(e.target.value)
              setError('')
            }}
          />
        </div>

        {medio === 'tdc2' && (
          <div className="space-y-2">
            <Select label="Cuándo se paga" value={payFrequency} onChange={(e) => setPayFrequency(e.target.value)}>
              <option value="anual">Una vez al año</option>
              <option value="semestral">Cada seis meses</option>
              <option value="mensual">Cada mes</option>
              <option value="">Sin cobro propio (fondo general)</option>
            </Select>
            {payFrequency !== '' && perYear > 0 && (
              <p className="text-xs text-muted">Apartando {money(Number(amount))} al mes juntas {money(perYear)} al año.</p>
            )}
          </div>
        )}

        {medio === 'tdc' && (
          <div className="rounded-xl border border-line bg-surface2 p-4">
            <Toggle
              checked={isValve}
              onChange={setIsValve}
              label="Es la válvula"
              description="Lo primero que se baja si el mes se aprieta"
            />
          </div>
        )}

        {error && <p className="text-xs font-medium text-negative">{error}</p>}

        <Button type="submit" size="lg" className="w-full">
          Guardar
        </Button>

        {isEdit &&
          (confirmDelete ? (
            <div className="rounded-xl border border-negative/40 bg-negative-soft p-3">
              <p className="text-sm font-medium text-ink">¿Quitar “{mode.line.name}” del plan?</p>
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
              Eliminar renglón
            </Button>
          ))}
      </form>
    </Modal>
  )
}
