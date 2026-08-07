import { Wifi, Wallet, PiggyBank, Pencil } from 'lucide-react'
import { formatMoney, formatPercent } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

const TYPE_LABEL = {
  credito: 'Crédito',
  debito: 'Débito',
  efectivo: 'Efectivo',
  ahorro: 'Ahorro',
}

export function AccountCard({ account, onRegisterMovement, onEdit }) {
  const isCredit = account.type === 'credito'
  const isSavings = account.type === 'ahorro'
  const utilization = isCredit && account.limit > 0 ? (account.used / account.limit) * 100 : 0
  const status = utilization > 90 ? 'danger' : utilization > 70 ? 'warning' : 'ok'
  const goalPercent = isSavings && account.goal > 0 ? Math.min((account.balance / account.goal) * 100, 100) : 0

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
        <div className="flex items-center gap-1.5">
          {isSavings ? (
            <PiggyBank className="h-6 w-6 text-white/70" />
          ) : account.type === 'efectivo' ? (
            <Wallet className="h-6 w-6 text-white/70" />
          ) : (
            <Wifi className="h-6 w-6 rotate-90 text-white/70" />
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(account)}
              aria-label={`Editar ${account.name}`}
              title="Editar cuenta"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
        ) : isSavings ? (
          <div>
            <p className="text-xs text-white/60">Ahorrado</p>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(account.balance)}</p>
            {account.goal > 0 && (
              <>
                <div className="mt-1.5">
                  <ProgressBar percent={goalPercent} status="brand" trackClassName="bg-white/20" />
                </div>
                <p className="mt-1.5 text-xs text-white/60">
                  Meta {formatMoney(account.goal)} · {formatPercent(goalPercent)}
                </p>
              </>
            )}
            {onRegisterMovement && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full bg-white/15 text-white hover:bg-white/25"
                onClick={() => onRegisterMovement(account)}
              >
                Registrar movimiento
              </Button>
            )}
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
