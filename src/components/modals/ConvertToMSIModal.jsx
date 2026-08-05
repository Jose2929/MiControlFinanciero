import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'
import { useFinance } from '../../context/FinanceContext'
import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'

const MONTH_OPTIONS = [3, 6, 9, 12]

export function ConvertToMSIModal({ transaction, onClose }) {
  const { convertExpenseToMSI } = useFinance()
  const [months, setMonths] = useState(3)
  const [customMonths, setCustomMonths] = useState('')
  const [interestFree, setInterestFree] = useState(true)
  const [monthlyRate, setMonthlyRate] = useState('')
  const [error, setError] = useState('')

  const effectiveMonths = customMonths ? Number(customMonths) : months

  const preview = useMemo(() => {
    if (!transaction || !effectiveMonths) return null
    const total = interestFree
      ? transaction.amount
      : transaction.amount * (1 + ((Number(monthlyRate) || 0) / 100) * effectiveMonths)
    return { total, perMonth: total / effectiveMonths }
  }, [transaction, effectiveMonths, interestFree, monthlyRate])

  if (!transaction) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!effectiveMonths || effectiveMonths < 2) {
      setError('Ingresa un número de meses válido (mínimo 2)')
      return
    }
    if (!interestFree && !Number(monthlyRate)) {
      setError('Ingresa la tasa de interés mensual')
      return
    }
    convertExpenseToMSI(transaction.id, {
      months: effectiveMonths,
      interestFree,
      monthlyRate: interestFree ? 0 : Number(monthlyRate),
    })
    onClose()
  }

  return (
    <Modal open={Boolean(transaction)} onClose={onClose} title="Convertir a meses sin intereses">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl bg-surface2 p-3.5 text-sm">
          <p className="text-muted">{transaction.note}</p>
          <p className="text-lg font-bold tabular-nums text-ink">{formatMoney(transaction.amount)}</p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink">Número de meses</span>
          <div className="flex flex-wrap gap-2">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMonths(m)
                  setCustomMonths('')
                  setError('')
                }}
                className={cn(
                  'h-9 min-w-[3rem] rounded-lg border px-3 text-sm font-medium transition-colors',
                  !customMonths && months === m
                    ? 'border-brand-400 bg-brand-500/10 text-brand-300'
                    : 'border-line bg-surface text-muted hover:text-ink'
                )}
              >
                {m}
              </button>
            ))}
            <input
              type="number"
              min="2"
              placeholder="Otro"
              value={customMonths}
              onChange={(e) => {
                setCustomMonths(e.target.value)
                setError('')
              }}
              className="h-9 w-20 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
        </div>

        <Toggle
          checked={interestFree}
          onChange={setInterestFree}
          label={interestFree ? 'Sin intereses' : 'Con intereses'}
          description={interestFree ? 'MSI · no se agrega ningún interés' : 'Se aplica una tasa mensual'}
        />

        {!interestFree && (
          <Input
            label="Tasa de interés mensual (%)"
            type="number"
            min="0"
            step="0.1"
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
          />
        )}

        {preview && (
          <p className="text-sm text-muted">
            {effectiveMonths} pagos mensuales de{' '}
            <span className="font-semibold text-ink">{formatMoney(preview.perMonth)}</span>
            {!interestFree && <> · total {formatMoney(preview.total)}</>}
          </p>
        )}

        {error && <p className="text-xs font-medium text-negative">{error}</p>}

        <Button type="submit" size="lg" className="w-full">
          Convertir gasto
        </Button>
      </form>
    </Modal>
  )
}
