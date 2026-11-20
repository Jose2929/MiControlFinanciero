import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useBudget } from '../../context/BudgetContext'
import { useFinance } from '../../context/FinanceContext'
import { reconcileEnvelope } from '../../lib/budgetBalances'
import { formatShortDate, formatSignedMoney, parseDateInputValue, toDateInputValue } from '../../lib/format'
import { cn } from '../../lib/cn'
import { money } from '../budget/money'

const MAX_HISTORY = 5

// Contar un sobre: "según la app tiene $X; en realidad tiene $Y". La
// diferencia se puede (1) corregir solo en el sobre, sin tocar tus cuentas, o
// (2) registrar como un gasto olvidado, que además baja la cuenta.
//
// item: elemento de computeEnvelopes ({ line, balance, ... }) del ciclo actual.
export function AdjustEnvelopeModal({ item, onClose }) {
  const { plan, addAdjustment, removeAdjustment } = useBudget()
  const { accounts, addExpense } = useFinance()

  const [actual, setActual] = useState('')
  const [mode, setMode] = useState('adjust') // 'adjust' | 'expense'
  const [accountId, setAccountId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const medio = item?.line.medio
  const mediAccounts = useMemo(
    () => (medio ? accounts.filter((a) => plan.accountMedios[a.id] === medio) : []),
    [accounts, plan.accountMedios, medio]
  )
  const history = useMemo(
    () =>
      item
        ? plan.adjustments
            .filter((a) => a.envelopeId === item.line.id)
            .slice(-MAX_HISTORY)
            .reverse()
        : [],
    [plan.adjustments, item]
  )

  useEffect(() => {
    if (!item) return
    setActual('')
    setMode('adjust')
    setAccountId(mediAccounts[0]?.id || '')
    setNote('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.line.id])

  if (!item) return null

  const rec = reconcileEnvelope({ balance: item.balance, actual })
  const canRegisterAsExpense = rec?.kind === 'missing' && mediAccounts.length > 0
  const effectiveMode = rec?.kind === 'missing' && mode === 'expense' && canRegisterAsExpense ? 'expense' : 'adjust'

  function handleSubmit(e) {
    e.preventDefault()
    if (!rec) return setError('Escribe cuánto tiene realmente.')
    if (Number(actual) < 0) return setError('La cantidad no puede ser negativa.')
    if (rec.kind === 'none') return onClose()
    if (effectiveMode === 'expense') {
      addExpense({
        amount: Math.abs(rec.difference),
        categoryId: 'otros',
        accountId: accountId || mediAccounts[0].id,
        envelopeId: item.line.id,
        note: note.trim() || `Gasto sin registrar (${item.line.name})`,
        date: toDateInputValue(new Date()),
      })
    } else {
      addAdjustment({
        envelopeId: item.line.id,
        amount: rec.difference,
        date: toDateInputValue(new Date()),
        note: note.trim() || 'Conteo del sobre',
      })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Contar ${item.line.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-line bg-surface2 p-4">
          <p className="text-xs text-muted">Según la app tiene</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{money(item.balance)}</p>
        </div>

        <Input
          label="¿Cuánto tiene realmente?"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          autoFocus
          value={actual}
          onChange={(e) => {
            setActual(e.target.value)
            setError('')
          }}
          error={error}
        />

        {rec && (
          <p
            className={cn(
              'text-sm font-medium',
              rec.kind === 'none' ? 'text-positive' : rec.kind === 'missing' ? 'text-negative' : 'text-warning'
            )}
          >
            {rec.kind === 'none' && 'Coincide con lo que dice la app.'}
            {rec.kind === 'missing' && `Faltan ${money(Math.abs(rec.difference))} respecto a la app.`}
            {rec.kind === 'extra' && `Hay ${money(rec.difference)} de más respecto a la app.`}
          </p>
        )}

        {rec?.kind === 'missing' && (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">¿Qué hacemos con la diferencia?</span>
            {[
              {
                id: 'adjust',
                title: 'Solo corregir el sobre',
                text: 'Deja el sobre en lo que hay. No toca tus cuentas.',
                disabled: false,
              },
              {
                id: 'expense',
                title: 'Fue un gasto que olvidé registrar',
                text: canRegisterAsExpense
                  ? 'Lo registra como gasto: baja el sobre y también la cuenta.'
                  : 'No hay una cuenta ligada a este medio (se asigna en Plan).',
                disabled: !canRegisterAsExpense,
              },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                aria-pressed={effectiveMode === option.id}
                onClick={() => setMode(option.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
                  effectiveMode === option.id
                    ? 'border-brand-400 bg-brand-500/10'
                    : 'border-line bg-surface2 hover:bg-line/50'
                )}
              >
                <p className="text-sm font-medium text-ink">{option.title}</p>
                <p className="text-xs text-muted">{option.text}</p>
              </button>
            ))}

            {effectiveMode === 'expense' && mediAccounts.length > 1 && (
              <Select label="Cuenta del gasto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {mediAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        {rec && rec.kind !== 'none' && (
          <Input
            label="Nota (opcional)"
            placeholder={effectiveMode === 'expense' ? 'Ej. Tacos' : 'Conteo del sobre'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}

        <Button type="submit" size="lg" className="w-full" disabled={!rec}>
          {rec?.kind === 'none' ? 'Listo, coincide' : effectiveMode === 'expense' ? 'Registrar gasto' : 'Actualizar sobre'}
        </Button>

        {history.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="mb-1 text-xs font-medium text-muted">Ajustes anteriores de este sobre</p>
            <ul className="divide-y divide-line">
              {history.map((adjustment) => (
                <li key={adjustment.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{adjustment.note || 'Conteo del sobre'}</p>
                    <p className="text-xs text-muted">{formatShortDate(parseDateInputValue(adjustment.date))}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      adjustment.amount < 0 ? 'text-negative' : 'text-positive'
                    )}
                  >
                    {formatSignedMoney(adjustment.amount, { cents: !Number.isInteger(adjustment.amount) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAdjustment(adjustment.id)}
                    aria-label="Quitar ajuste"
                    title="Quitar ajuste"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  )
}
