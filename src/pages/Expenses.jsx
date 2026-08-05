import { useMemo, useState } from 'react'
import { Search, Receipt, X } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { TransactionRow } from '../components/finance/TransactionRow'
import { MoneyText } from '../components/finance/MoneyText'
import { ConvertToMSIModal } from '../components/modals/ConvertToMSIModal'
import { formatGroupLabel, formatMoney, startOfDay } from '../lib/format'
import { getSubcategory } from '../lib/categories'
import { cn } from '../lib/cn'

export default function Expenses() {
  const { transactions, allCategories, accounts, findCategory } = useFinance()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [accountId, setAccountId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [convertingTx, setConvertingTx] = useState(null)

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])

  const expenses = useMemo(() => {
    const query = search.trim().toLowerCase()
    const from = dateFrom ? startOfDay(dateFrom).getTime() : null
    const to = dateTo ? startOfDay(dateTo).getTime() : null

    return transactions
      .filter((t) => t.type === 'expense')
      .filter((t) => categoryId === 'all' || t.categoryId === categoryId)
      .filter((t) => accountId === 'all' || t.accountId === accountId)
      .filter((t) => {
        const time = startOfDay(t.date).getTime()
        if (from !== null && time < from) return false
        if (to !== null && time > to) return false
        return true
      })
      .filter((t) => {
        if (!query) return true
        const category = findCategory(t.categoryId)
        const account = accountMap[t.accountId]
        return (
          t.note?.toLowerCase().includes(query) ||
          category?.label.toLowerCase().includes(query) ||
          account?.name.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, search, categoryId, accountId, dateFrom, dateTo, findCategory, accountMap])

  const groups = useMemo(() => {
    const map = new Map()
    expenses.forEach((t) => {
      const key = startOfDay(t.date).toISOString()
      if (!map.has(key)) map.set(key, { date: t.date, items: [] })
      map.get(key).items.push(t)
    })
    return [...map.values()]
  }, [expenses])

  const hasFilters = categoryId !== 'all' || accountId !== 'all' || dateFrom || dateTo || search

  function clearFilters() {
    setSearch('')
    setCategoryId('all')
    setAccountId('all')
    setDateFrom('')
    setDateTo('')
  }

  const total = expenses.filter((t) => !t.convertedToMsi).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nota, categoría o cuenta…"
          className="h-11 w-full rounded-xl border border-line bg-surface2 pl-10 pr-4 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
        />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select
            containerClassName="col-span-1"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            containerClassName="col-span-1"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="all">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input
            containerClassName="col-span-1"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            containerClassName="col-span-1"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </Card>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted">
          {expenses.length} transacci{expenses.length === 1 ? 'ón' : 'ones'}
        </p>
        <p className="text-sm font-semibold text-ink">
          Total <MoneyText amount={total} variant="negative" />
        </p>
      </div>

      {groups.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={Receipt}
            title="No encontramos gastos"
            description="Ajusta los filtros o registra un nuevo gasto con el botón +."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const groupTotal = group.items
              .filter((t) => !t.convertedToMsi)
              .reduce((s, t) => s + t.amount, 0)
            return (
              <Card key={group.date.toString()} className={cn('animate-fade-in-up p-4')}>
                <div className="mb-1 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-ink">{formatGroupLabel(group.date)}</h3>
                  <span className="text-xs font-medium text-muted">{formatMoney(groupTotal)}</span>
                </div>
                <div className="divide-y divide-line">
                  {group.items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      category={findCategory(t.categoryId)}
                      subcategory={getSubcategory(t.categoryId, t.subcategoryId)}
                      account={accountMap[t.accountId]}
                      onConvertToMsi={setConvertingTx}
                    />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConvertToMSIModal transaction={convertingTx} onClose={() => setConvertingTx(null)} />
    </div>
  )
}
