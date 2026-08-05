import { useMemo } from 'react'
import { BellOff } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { NotificationItem } from '../components/finance/NotificationItem'
import { diffInDays } from '../lib/format'

function groupNotifications(notifications) {
  const groups = { today: [], week: [], older: [] }
  notifications.forEach((n) => {
    const diff = diffInDays(n.date)
    if (diff === 0) groups.today.push(n)
    else if (diff >= -7) groups.week.push(n)
    else groups.older.push(n)
  })
  return groups
}

export default function Notifications() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useFinance()
  const groups = useMemo(() => groupNotifications(notifications), [notifications])

  const sections = [
    { key: 'today', label: 'Hoy', items: groups.today },
    { key: 'week', label: 'Esta semana', items: groups.week },
    { key: 'older', label: 'Anteriores', items: groups.older },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
        </p>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllNotificationsRead}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {sections.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={BellOff}
            title="Sin notificaciones"
            description="Aquí verás alertas de pagos próximos y presupuestos cerca del límite."
          />
        </Card>
      ) : (
        sections.map((section) => (
          <Card key={section.key} className="animate-fade-in-up p-3">
            <h3 className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {section.label}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markNotificationRead} />
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
