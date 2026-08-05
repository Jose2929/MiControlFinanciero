import { Wifi, Wallet } from 'lucide-react'
import { formatMoney, formatPercent } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'
import { cn } from '../../lib/cn'

const TYPE_LABEL = {
  credito: 'Crédito',
  debito: 'Débito',
  efectivo: 'Efectivo',
}

export function AccountCard({ account }) {
  const isCredit = account.type === 'credito'
  const utilization = isCredit && account.limit > 0 ? (account.used / account.limit) * 100 : 0
  const status = utilization > 90 ? 'danger' : utilization > 70 ? 'warning' : 'ok'

  return (
    <div
      className={cn(
        'relative flex h-48 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-soft',
        account.gradient
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{account.name}</p>
          <p className="text-xs text-white/60">{TYPE_LABEL[account.type]}</p>
        </div>
        {account.type === 'efectivo' ? (
          <Wallet className="h-6 w-6 text-white/70" />
        ) : (
          <Wifi className="h-6 w-6 rotate-90 text-white/70" />
        )}
      </div>

      <div className="relative">
        {account.last4 && (
          <p className="mb-3 font-mono text-lg tracking-widest text-white/90">
            •••• •••• •••• {account.last4}
          </p>
        )}

        {isCredit ? (
          <div>
            <div className="mb-1.5 flex items-end justify-between text-sm">
              <span className="text-white/70">Usado {formatMoney(account.used)}</span>
              <span className="text-white/70">{formatPercent(utilization)}</span>
            </div>
            <ProgressBar percent={utilization} status={status} trackClassName="bg-white/20" />
            <p className="mt-1.5 text-xs text-white/60">
              Límite {formatMoney(account.limit)} · Disponible {formatMoney(account.limit - account.used)}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-white/60">Saldo disponible</p>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(account.balance)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
