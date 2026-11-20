import { Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { MEDIO_LABELS, MEDIO_ORDER } from '../../lib/budget'
import { ACCOUNT_TYPE_LABELS, suggestAccountMedios } from '../../lib/budgetEnvelopes'

// Liga cada cuenta de la app con su medio del presupuesto (TDC, TDC2, Débito…).
// Se hace una sola vez; con eso, cada gasto sabe a qué medio pertenece por la
// cuenta con la que se registró. El vínculo es por id, así que renombrar una
// cuenta no lo rompe.
export function AccountsCard({ accounts, accountMedios, onChange }) {
  const suggestions = suggestAccountMedios(accounts, accountMedios)
  const suggestionCount = Object.keys(suggestions).length
  const missing = MEDIO_ORDER.filter((medio) => !accounts.some((a) => accountMedios[a.id] === medio))

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Cuentas de la app</h3>
          <p className="text-xs text-muted">
            Así el presupuesto sabe de qué medio sale cada gasto. Se hace una sola vez.
          </p>
        </div>
        {suggestionCount > 0 && (
          <Button type="button" size="sm" variant="secondary" onClick={() => onChange(suggestions)}>
            <Sparkles className="h-4 w-4" />
            Sugerir ({suggestionCount})
          </Button>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">Aún no tienes cuentas registradas.</p>
      ) : (
        <div className="mt-3 divide-y divide-line">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 px-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{account.name}</p>
                <p className="truncate text-xs text-muted">
                  {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                  {account.last4 ? ` · ••${account.last4}` : ''}
                </p>
              </div>
              <Select
                aria-label={`Medio de ${account.name}`}
                containerClassName="w-44 shrink-0"
                value={accountMedios[account.id] || ''}
                onChange={(e) => onChange({ [account.id]: e.target.value || null })}
              >
                <option value="">Fuera del presupuesto</option>
                {MEDIO_ORDER.map((medio) => (
                  <option key={medio} value={medio}>
                    {MEDIO_LABELS[medio]}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && accounts.length > 0 && (
        <p className="mt-2 border-t border-line px-1 pt-3 text-xs text-warning">
          Aún no hay una cuenta para: {missing.map((m) => MEDIO_LABELS[m]).join(', ')}. Si falta crearla, hazlo en
          Cuentas (apartado Registro) y asígnala aquí.
        </p>
      )}
    </Card>
  )
}
