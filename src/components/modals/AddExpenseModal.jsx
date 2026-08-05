import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Toggle } from '../ui/Toggle'
import { useFinance } from '../../context/FinanceContext'
import { cn } from '../../lib/cn'
import { categoryColorValue } from '../../lib/categories'
import { formatMoney } from '../../lib/format'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const MONTH_OPTIONS = [3, 6, 9, 12]

export function AddExpenseModal({ open, onClose }) {
  const { allCategories, accounts, addExpense, addExpenseDeferred } = useFinance()
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(allCategories[0]?.id)
  const [subcategoryId, setSubcategoryId] = useState(null)
  const [accountId, setAccountId] = useState(accounts[0]?.id)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  const [deferred, setDeferred] = useState(false)
  const [months, setMonths] = useState(3)
  const [customMonths, setCustomMonths] = useState('')
  const [interestFree, setInterestFree] = useState(true)
  const [monthlyRate, setMonthlyRate] = useState('')

  const category = allCategories.find((c) => c.id === categoryId)
  const effectiveMonths = customMonths ? Number(customMonths) : months

  function reset() {
    setAmount('')
    setCategoryId(allCategories[0]?.id)
    setSubcategoryId(null)
    setAccountId(accounts[0]?.id)
    setNote('')
    setDate(todayISO())
    setError('')
    setDeferred(false)
    setMonths(3)
    setCustomMonths('')
    setInterestFree(true)
    setMonthlyRate('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectCategory(id) {
    setCategoryId(id)
    setSubcategoryId(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (deferred) {
      if (!effectiveMonths || effectiveMonths < 2) {
        setError('Ingresa un número de meses válido (mínimo 2)')
        return
      }
      if (!interestFree && !Number(monthlyRate)) {
        setError('Ingresa la tasa de interés mensual')
        return
      }
      addExpenseDeferred({
        amount: value,
        months: effectiveMonths,
        interestFree,
        monthlyRate: interestFree ? 0 : Number(monthlyRate),
        categoryId,
        subcategoryId,
        accountId,
        note,
        date,
      })
    } else {
      addExpense({ amount: value, categoryId, subcategoryId, accountId, note, date })
    }
    handleClose()
  }

  function handleAmountChange(e) {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(raw)
    if (error) setError('')
  }

  const monthlyPreview = useMemo(() => {
    const value = Number(amount)
    if (!deferred || !value || !effectiveMonths) return null
    const total = interestFree ? value : value * (1 + (Number(monthlyRate) || 0) / 100 * effectiveMonths)
    return { total, perMonth: total / effectiveMonths }
  }, [deferred, amount, effectiveMonths, interestFree, monthlyRate])

  return (
    <Modal open={open} onClose={handleClose} title="Agregar gasto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-sm text-muted">Monto</span>
          <div className="flex items-center gap-1">
            <span className="text-3xl font-semibold text-muted">$</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
              className="w-48 bg-transparent text-center text-5xl font-bold tabular-nums text-ink outline-none placeholder:text-muted"
            />
          </div>
          {error && <span className="text-xs font-medium text-negative">{error}</span>}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink">Categoría</span>
          <div className="grid grid-cols-4 gap-2.5">
            {allCategories.map((cat) => {
              const active = cat.id === categoryId
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all duration-150',
                    active
                      ? 'border-brand-400 bg-brand-500/10 ring-2 ring-brand-400/30'
                      : 'border-line bg-surface2 hover:bg-line/50'
                  )}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${categoryColorValue(cat)} 18%, transparent)`,
                      color: categoryColorValue(cat),
                    }}
                  >
                    <cat.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-ink">
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {category?.subcategories?.length > 0 && (
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">Subcategoría</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubcategoryId(null)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  !subcategoryId
                    ? 'border-brand-400 bg-brand-500/10 text-brand-300'
                    : 'border-line bg-surface2 text-muted hover:text-ink'
                )}
              >
                General
              </button>
              {category.subcategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubcategoryId(sub.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    subcategoryId === sub.id
                      ? 'border-brand-400 bg-brand-500/10 text-brand-300'
                      : 'border-line bg-surface2 text-muted hover:text-ink'
                  )}
                >
                  <sub.icon className="h-3.5 w-3.5" />
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Select label="Cuenta o tarjeta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          <Input label="Nota (opcional)" placeholder="Ej. Cena con amigos" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="rounded-xl border border-line bg-surface2 p-4">
          <Toggle
            checked={deferred}
            onChange={setDeferred}
            label="Diferir a meses sin intereses"
            description="Convierte este gasto en pagos mensuales"
          />

          {deferred && (
            <div className="mt-4 space-y-4 border-t border-line pt-4">
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
                    onChange={(e) => setCustomMonths(e.target.value)}
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

              {monthlyPreview && (
                <p className="text-sm text-muted">
                  {effectiveMonths} pagos mensuales de{' '}
                  <span className="font-semibold text-ink">{formatMoney(monthlyPreview.perMonth)}</span>
                  {!interestFree && (
                    <> · total {formatMoney(monthlyPreview.total)}</>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full">
          {deferred ? 'Diferir gasto' : 'Guardar gasto'}
        </Button>
      </form>
    </Modal>
  )
}
