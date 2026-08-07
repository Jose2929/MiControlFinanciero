import { ArrowUpRight, HandCoins, Layers, Pencil } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { categoryColorValue } from '../../lib/categories'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/cn'

export function TransactionRow({
  transaction,
  category,
  subcategory,
  account,
  sourceLabel,
  author,
  onConvertToMsi,
  onEdit,
}) {
  const isIncome = transaction.type === 'income'
  const isDebtPayment = transaction.type === 'debt_payment'
  const converted = Boolean(transaction.convertedToMsi)
  const canConvert = transaction.type === 'expense' && !converted && Boolean(onConvertToMsi)
  const canEdit = (transaction.type === 'expense' || isDebtPayment) && !converted && Boolean(onEdit)

  const Icon = isIncome ? ArrowUpRight : isDebtPayment ? HandCoins : category?.icon
  const iconColor = isIncome ? '#10B981' : isDebtPayment ? '#F59E0B' : categoryColorValue(category)
  const title = isIncome ? transaction.note || 'Ingreso' : isDebtPayment ? transaction.note || 'Pago de deuda' : transaction.note || category?.label

  const subtitle = [
    sourceLabel,
    isDebtPayment && category ? category.label : null,
    subcategory ? `${category?.label} · ${subcategory.label}` : null,
    account?.name || 'Efectivo',
    author?.name || author?.email || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: `color-mix(in srgb, ${iconColor} 16%, transparent)`,
          color: iconColor,
        }}
      >
        {Icon && <Icon className="h-4.5 w-4.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {converted && (
            <Badge variant="brand" className="shrink-0">
              Convertido a MSI
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          converted
            ? 'text-muted line-through'
            : isIncome
              ? 'text-positive'
              : isDebtPayment
                ? 'text-warning'
                : 'text-negative'
        )}
      >
        {isIncome ? '+' : '−'}
        {formatMoney(transaction.amount)}
      </span>
      {canConvert && (
        <button
          type="button"
          onClick={() => onConvertToMsi(transaction)}
          aria-label="Convertir a meses sin intereses"
          title="Convertir a meses sin intereses"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-brand-400"
        >
          <Layers className="h-4 w-4" />
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          aria-label="Editar transacción"
          title="Editar o eliminar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
