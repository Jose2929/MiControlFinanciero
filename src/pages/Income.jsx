import { useMemo, useState } from 'react'
import { Plus, Wallet, TrendingUp } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SegmentedTabs } from '../components/ui/SegmentedTabs'
import { EmptyState } from '../components/ui/EmptyState'
import { TransactionRow } from '../components/finance/TransactionRow'
import { MoneyText } from '../components/finance/MoneyText'
import { AddIncomeModal } from '../components/modals/AddIncomeModal'
import { formatGroupLabel, startOfDay } from '../lib/format'

const MODE_CAPTION = {
  resico: 'Neto después de IVA e ISR',
  hourly: 'Variable según horas trabajadas',
  fixed: 'Monto fijo',
}

export default function Income() {
  const { transactions, accounts, incomeProfiles, findIncomeProfile, monthIncome, monthIncomeBySource } =
    useFinance()
  const [source, setSource] = useState('all')
  const [open, setOpen] = useState(false)

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])
  const bySourceMap = useMemo(
    () => Object.fromEntries(monthIncomeBySource.map((s) => [s.id, s.amount])),
    [monthIncomeBySource]
  )

  const incomeTx = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .filter((t) => source === 'all' || t.incomeSourceId === source)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, source])

  const groups = useMemo(() => {
    const map = new Map()
    incomeTx.forEach((t) => {
      const key = startOfDay(t.date).toISOString()
      if (!map.has(key)) map.set(key, { date: t.date, items: [] })
      map.get(key).items.push(t)
    })
    return [...map.values()]
  }, [incomeTx])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <TrendingUp className="h-4 w-4" />
            Total combinado del mes
          </div>
          <p className="mt-2 text-2xl font-bold">
            <MoneyText amount={monthIncome} variant="positive" />
          </p>
        </Card>
        {incomeProfiles.map((profile) => (
          <Card key={profile.id} className="p-5">
            <p className="text-sm text-muted">{profile.label}</p>
            <p className="mt-2 text-2xl font-bold">
              <MoneyText amount={bySourceMap[profile.id] || 0} />
            </p>
            <p className="mt-1 text-xs text-muted">{MODE_CAPTION[profile.mode] || 'Ingreso'}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          tabs={[
            { value: 'all', label: 'Todos' },
            ...incomeProfiles.map((p) => ({ value: p.id, label: p.label })),
          ]}
          value={source}
          onChange={setSource}
        />
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar ingreso
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={Wallet}
            title="Sin ingresos registrados"
            description="Agrega tu primer ingreso con el botón de arriba."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.date.toString()} className="animate-fade-in-up p-4">
              <h3 className="mb-1 px-1 text-sm font-semibold text-ink">{formatGroupLabel(group.date)}</h3>
              <div className="divide-y divide-line">
                {group.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    account={accountMap[t.accountId]}
                    sourceLabel={findIncomeProfile(t.incomeSourceId)?.label}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddIncomeModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
