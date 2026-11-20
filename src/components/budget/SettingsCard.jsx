import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { getCycleForDate } from '../../lib/budget'
import { SETTING_LIMITS, isValidSettingValue } from '../../lib/budgetPlan'
import { formatShortDate } from '../../lib/format'

// Un número entero con su rango. Se guarda al salir del campo (o con Enter),
// no en cada tecla — cada guardado es una escritura a Firebase.
function SettingField({ name, label, hint, value, onCommit }) {
  const [min, max] = SETTING_LIMITS[name]
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(String(value))
    setError('')
  }, [value])

  function commit() {
    if (draft.trim() === String(value)) {
      setError('')
      return
    }
    if (!isValidSettingValue(name, draft)) {
      setError(`Escribe un número entero del ${min} al ${max}`)
      return
    }
    setError('')
    onCommit({ [name]: Number(draft) })
  }

  return (
    <div>
      <Input
        label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        error={error}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function SettingsCard({ settings, onChange }) {
  const cycle = getCycleForDate(new Date(), settings.cycleStartDay)

  return (
    <Card className="p-4">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-ink">Fechas y ciclo</h3>
        <p className="text-xs text-muted">Se guardan al salir del campo.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
        <SettingField
          name="cycleStartDay"
          label="El ciclo de gasto inicia el día"
          hint={`1 = mes calendario. Ciclo actual: ${formatShortDate(cycle.start)} – ${formatShortDate(cycle.end)} (${cycle.days} días).`}
          value={settings.cycleStartDay}
          onCommit={onChange}
        />
        <SettingField
          name="cutDay"
          label="Día de corte de la TDC"
          value={settings.cutDay}
          onCommit={onChange}
        />
        <SettingField
          name="payDueDay"
          label="Fecha límite de pago de la TDC (día)"
          value={settings.payDueDay}
          onCommit={onChange}
        />
        <SettingField
          name="spendTransferDay"
          label="Día en que se reparte a TDC2, débito y efectivo"
          hint="Debe ser un día de pago de tu sueldo."
          value={settings.spendTransferDay}
          onCommit={onChange}
        />
        <SettingField
          name="cashWithdrawalParts"
          label="Partes en que se retira el efectivo"
          value={settings.cashWithdrawalParts}
          onCommit={onChange}
        />
      </div>
    </Card>
  )
}
