import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { AdjustmentHistory } from '../budget/AdjustmentHistory'
import { useBudget } from '../../context/BudgetContext'
import { movementAmount } from '../../lib/budgetBalances'
import { toDateInputValue } from '../../lib/format'
import { cn } from '../../lib/cn'
import { money } from '../budget/money'

const DIRECTIONS = [
  { id: 'in', label: 'Agregar' },
  { id: 'out', label: 'Sacar' },
]

const HELP = {
  in: 'Suma dinero a este sobre sin tocar tus cuentas (un ingreso extra, algo que te sobró…).',
  out: 'Quita dinero del sobre sin registrar un gasto. Si fue una compra, mejor usa "Gasto": así también baja tu cuenta.',
}

// Agregar o sacar dinero de un sobre a mano. Se guarda como un ajuste con
// signo (así se ve en el historial y se puede deshacer); no registra un gasto
// ni mueve tus cuentas.
//
// item: elemento de computeEnvelopes ({ line, balance, ... }) del ciclo actual.
export function EnvelopeMoneyModal({ item, direction: initialDirection = 'in', onClose }) {
  const { addAdjustment } = useBudget()
  const [direction, setDirection] = useState(initialDirection)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!item) return
    setDirection(initialDirection)
    setAmount('')
    setNote('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.line.id, initialDirection])

  if (!item) return null

  const signed = movementAmount(direction, amount)
  const after = signed == null ? null : Math.round((item.balance + signed) * 100) / 100
  const verb = direction === 'in' ? 'Agregar' : 'Sacar'
  const submitLabel =
    signed == null ? (direction === 'in' ? 'Agregar al sobre' : 'Sacar del sobre') : `${verb} ${money(Math.abs(signed))}`

  function handleSubmit(e) {
    e.preventDefault()
    if (signed == null) return setError('Escribe un monto mayor a cero.')
    addAdjustment({
      envelopeId: item.line.id,
      amount: signed,
      date: toDateInputValue(new Date()),
      note: note.trim() || (direction === 'in' ? 'Dinero agregado' : 'Dinero retirado'),
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={direction === 'in' ? `Agregar a ${item.line.name}` : `Sacar de ${item.line.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-line bg-surface2 p-4">
          <p className="text-xs text-muted">Hoy tiene</p>
          <p className={cn('text-2xl font-bold tabular-nums', item.balance < 0 ? 'text-negative' : 'text-ink')}>
            {money(item.balance)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Qué quieres hacer">
          {DIRECTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={direction === option.id}
              onClick={() => {
                setDirection(option.id)
                setError('')
              }}
              className={cn(
                'h-10 rounded-xl border text-sm font-medium transition-colors',
                direction === option.id
                  ? 'border-brand-400 bg-brand-500/10 text-ink'
                  : 'border-line bg-surface2 text-muted hover:text-ink'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="-mt-1 text-xs text-muted">{HELP[direction]}</p>

        <Input
          label={direction === 'in' ? '¿Cuánto agregas?' : '¿Cuánto sacas?'}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            setError('')
          }}
          error={error}
        />

        {after != null && (
          <p className={cn('text-sm font-medium', after < 0 ? 'text-negative' : 'text-muted')}>
            Quedaría en <span className="tabular-nums text-ink">{money(after)}</span>
            {after < 0 && ' · te pasarías de lo disponible'}
          </p>
        )}

        <Input
          label="Nota (opcional)"
          placeholder={direction === 'in' ? 'Dinero agregado' : 'Dinero retirado'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button type="submit" size="lg" className="w-full" disabled={signed == null}>
          {submitLabel}
        </Button>

        <AdjustmentHistory envelopeId={item.line.id} />
      </form>
    </Modal>
  )
}
