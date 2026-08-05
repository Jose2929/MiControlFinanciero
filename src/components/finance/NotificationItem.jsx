import { CalendarClock, PiggyBank, Info, BarChart3, Repeat } from 'lucide-react'
import { formatFullDate } from '../../lib/format'
import { cn } from '../../lib/cn'

const KIND_CONFIG = {
  payment: { icon: CalendarClock, cls: 'bg-negative-soft text-negative' },
  budget: { icon: PiggyBank, cls: 'bg-warning-soft text-warning' },
  recurring: { icon: Repeat, cls: 'bg-warning-soft text-warning' },
  info: { icon: Info, cls: 'bg-brand-500/15 text-brand-300' },
  summary: { icon: BarChart3, cls: 'bg-positive-soft text-positive' },
}

export function NotificationItem({ notification, onRead }) {
  const config = KIND_CONFIG[notification.kind] || KIND_CONFIG.info
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={() => onRead(notification.id)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        notification.read ? 'hover:bg-surface2' : 'bg-brand-500/[0.06] hover:bg-brand-500/10'
      )}
    >
      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', config.cls)}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-ink">{notification.title}</p>
          {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
        </div>
        <p className="mt-0.5 text-sm text-muted">{notification.message}</p>
        <p className="mt-1 text-xs text-muted">{formatFullDate(notification.date)}</p>
      </div>
    </button>
  )
}
