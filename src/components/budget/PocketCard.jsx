import { Card } from '../ui/Card'
import { cn } from '../../lib/cn'
import { targetPerPayment } from '../../lib/budget'
import { formatSignedMoney } from '../../lib/format'
import { EnvelopeActions } from './EnvelopeActions'
import { FREQUENCY_LABELS, money } from './money'

// Un bolsillo de TDC2 (Seguro Moto, Tenencia…): lo que se aparta cada mes se
// acumula hasta que llega el cobro, y cuando se ocupa se descuenta de aquí.
export function PocketCard({ item, actions }) {
  const { line, assigned, spent, adjusted, balance } = item
  const target = targetPerPayment(line)
  const percent = target > 0 ? Math.max(0, Math.min((balance / target) * 100, 100)) : 0
  const missing = target != null ? Math.max(target - balance, 0) : null

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{line.name}</p>
          <p className="text-xs text-muted">
            {FREQUENCY_LABELS[line.payFrequency]} · se aparta {money(line.amount)} al mes
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">Juntado</p>
          <p className={cn('text-lg font-bold tabular-nums', balance < 0 ? 'text-negative' : 'text-ink')}>
            {money(balance)}
          </p>
        </div>
      </div>

      {target != null && (
        <div className="mt-3">
          <div
            role="img"
            aria-label={`Juntado ${money(balance)} de ${money(target)}`}
            className="h-2 w-full overflow-hidden rounded-full bg-surface2"
          >
            <div className="brand-gradient h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {missing > 0 ? `Meta del cobro ${money(target)} · faltan ${money(missing)}` : `Ya juntas lo del cobro (${money(target)})`}
          </p>
        </div>
      )}

      {(spent > 0 || adjusted !== 0 || assigned === 0) && (
        <p className="mt-1 text-xs text-muted">
          {spent > 0 && <>Gastado en este ciclo {money(spent)}. </>}
          {adjusted !== 0 && (
            <>Ajuste {formatSignedMoney(adjusted, { cents: !Number.isInteger(adjusted) })}. </>
          )}
          {assigned === 0 && 'Todavía no acumula en este ciclo.'}
        </p>
      )}

      {actions && <EnvelopeActions item={item} {...actions} className="mt-3" />}
    </Card>
  )
}
