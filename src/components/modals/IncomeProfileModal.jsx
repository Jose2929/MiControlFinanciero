import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useFinance } from '../../context/FinanceContext'

const MODE_TABS = [
  { value: 'resico', label: 'RESICO' },
  { value: 'hourly', label: 'Por hora' },
  { value: 'fixed', label: 'Monto fijo' },
]

// mode: { type: 'create' } | { type: 'edit', profile }
export function IncomeProfileModal({ mode, onClose }) {
  const { addIncomeProfile, updateIncomeProfile } = useFinance()
  const isEdit = mode?.type === 'edit'

  const [label, setLabel] = useState('')
  const [profileMode, setProfileMode] = useState('fixed')
  const [payFrequency, setPayFrequency] = useState('mensual')
  const [defaultIvaPercent, setDefaultIvaPercent] = useState('16')
  const [defaultIsrPercent, setDefaultIsrPercent] = useState('1.5')
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('150')
  const [defaultAmount, setDefaultAmount] = useState('')

  useEffect(() => {
    if (!mode) return
    if (isEdit) {
      const p = mode.profile
      setLabel(p.label)
      setProfileMode(p.mode)
      setPayFrequency(p.payFrequency || 'mensual')
      setDefaultIvaPercent(String(p.defaultIvaPercent ?? 16))
      setDefaultIsrPercent(String(p.defaultIsrPercent ?? 1.5))
      setDefaultHourlyRate(String(p.defaultHourlyRate ?? 150))
      setDefaultAmount(String(p.defaultAmount ?? ''))
    } else {
      setLabel('')
      setProfileMode('fixed')
      setPayFrequency('mensual')
      setDefaultIvaPercent('16')
      setDefaultIsrPercent('1.5')
      setDefaultHourlyRate('150')
      setDefaultAmount('')
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!label.trim()) return
    const data = {
      label: label.trim(),
      mode: profileMode,
      payFrequency,
      // Coercionar aquí (no solo en el alta) — updateIncomeProfile hace un
      // merge directo sin convertir tipos, así que editar sin tocar nada
      // guardaba estos campos como string en vez de number.
      defaultIvaPercent: Number(defaultIvaPercent) || 0,
      defaultIsrPercent: Number(defaultIsrPercent) || 0,
      defaultHourlyRate: Number(defaultHourlyRate) || 0,
      defaultAmount: Number(defaultAmount) || 0,
    }
    if (isEdit) {
      updateIncomeProfile(mode.profile.id, data)
    } else {
      addIncomeProfile(data)
    }
    onClose()
  }

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={isEdit ? 'Editar perfil de ingreso' : 'Agregar perfil de ingreso'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre" placeholder="Ej. Ingreso de renta" value={label} onChange={(e) => setLabel(e.target.value)} required />

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Modo de cálculo</p>
          <SegmentedTabs className="w-full" tabs={MODE_TABS} value={profileMode} onChange={setProfileMode} />
        </div>

        <SegmentedTabs
          tabs={[
            { value: 'quincenal', label: 'Quincenal' },
            { value: 'mensual', label: 'Mensual' },
          ]}
          value={payFrequency}
          onChange={setPayFrequency}
        />

        {profileMode === 'resico' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="IVA trasladado (%) por defecto"
              type="number"
              min="0"
              step="0.1"
              value={defaultIvaPercent}
              onChange={(e) => setDefaultIvaPercent(e.target.value)}
            />
            <Input
              label="ISR RESICO (%) por defecto"
              type="number"
              min="0"
              step="0.1"
              value={defaultIsrPercent}
              onChange={(e) => setDefaultIsrPercent(e.target.value)}
            />
          </div>
        )}

        {profileMode === 'hourly' && (
          <Input
            label="Tarifa por hora por defecto"
            type="number"
            min="0"
            value={defaultHourlyRate}
            onChange={(e) => setDefaultHourlyRate(e.target.value)}
          />
        )}

        {profileMode === 'fixed' && (
          <Input
            label="Monto fijo por defecto (opcional)"
            type="number"
            min="0"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
          />
        )}

        <Button type="submit" size="lg" className="w-full">
          Guardar perfil
        </Button>
      </form>
    </Modal>
  )
}
