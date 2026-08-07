import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney, formatPercent } from '../../lib/format'
import { categoryColorValue } from '../../lib/categories'
import { EmptyState } from '../ui/EmptyState'
import { PieChart as PieIcon } from 'lucide-react'

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: categoryColorValue(item.category) }}
        />
        <span className="font-medium text-ink">{item.category.label}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
        {formatMoney(item.amount)}
        <span className="ml-1.5 font-normal text-muted">{formatPercent(item.percent)}</span>
      </p>
    </div>
  )
}

export function CategoryDonut({ data }) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  if (!data.length) {
    return (
      <EmptyState
        icon={PieIcon}
        title="Sin gastos este mes"
        description="Cuando registres un gasto, verás aquí su distribución por categoría."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="categoryId"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="rgb(var(--color-surface))"
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={categoryColorValue(entry.category)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">Total</span>
          <span className="text-xl font-bold tabular-nums text-ink">{formatMoney(total)}</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5">
        {data.map((entry) => (
          <li key={entry.categoryId} className="flex items-center gap-3 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColorValue(entry.category) }}
            />
            <entry.category.icon className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.category.label}</span>
            <span className="shrink-0 text-xs text-muted">{formatPercent(entry.percent)}</span>
            <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-ink">
              {formatMoney(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
