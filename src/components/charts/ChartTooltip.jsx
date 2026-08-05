import { formatMoney } from '../../lib/format'

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft">
      {label && <p className="mb-1 text-xs font-medium text-muted">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {entry.color && (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          )}
          <span className="font-semibold tabular-nums text-ink">
            {formatMoney(entry.value)}
          </span>
          {entry.name && <span className="text-muted">{entry.name}</span>}
        </div>
      ))}
    </div>
  )
}
