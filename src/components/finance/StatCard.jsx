import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card } from '../ui/Card'
import { MoneyText } from './MoneyText'
import { cn } from '../../lib/cn'

const ICON_BG = {
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
}

export function StatCard({
  icon: Icon,
  label,
  value,
  variant = 'positive',
  delta,
  deltaGoodDirection = 'down',
  onClick,
}) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const isUp = hasDelta && delta > 0
  const isFlat = hasDelta && Math.abs(delta) < 0.5
  const isGood = hasDelta && !isFlat && (deltaGoodDirection === 'down' ? delta < 0 : delta > 0)

  return (
    <Card
      as={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'animate-fade-in-up p-5',
        onClick && 'w-full text-left transition-transform hover:scale-[1.01] active:scale-[0.99]'
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', ICON_BG[variant])}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold">
        <MoneyText amount={value} />
      </p>
      {hasDelta && (
        <div
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 text-xs font-medium',
            isFlat ? 'text-muted' : isGood ? 'text-positive' : 'text-negative'
          )}
        >
          {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(0)}% vs. mes anterior
        </div>
      )}
    </Card>
  )
}
