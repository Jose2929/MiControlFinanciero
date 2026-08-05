import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useFinance } from '../../context/FinanceContext'
import { formatMoney } from '../../lib/format'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function AddIncomeModal({ open, onClose }) {
  const { accounts, incomeProfiles, findIncomeProfile, addIncome } = useFinance()
  const [sourceId, setSourceId] = useState(incomeProfiles[0]?.id)
  const [accountId, setAccountId] = useState(accounts[0]?.id)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  const [grossAmount, setGrossAmount] = useState('')
  const [ivaPercent, setIvaPercent] = useState('')
  const [isrPercent, setIsrPercent] = useState('')

  const [payMode, setPayMode] = useState('hours')
  const [hours, setHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')

  const [fixedAmount, setFixedAmount] = useState('')

  const profile = findIncomeProfile(sourceId)

  // Re-seed the fields for whichever mode the selected profile uses with its defaults.
  useEffect(() => {
    if (!open) return
    const p = findIncomeProfile(sourceId)
    setError('')
    if (p.mode === 'resico') {
      setGrossAmount('')
      setIvaPercent(String(p.defaultIvaPercent ?? 0))
      setIsrPercent(String(p.defaultIsrPercent ?? 0))
    } else if (p.mode === 'hourly') {
      setPayMode('hours')
      setHours('')
      setHourlyRate(String(p.defaultHourlyRate ?? 0))
      setTotalAmount('')
    } else {
      setFixedAmount('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, open])

  function reset() {
    setSourceId(incomeProfiles[0]?.id)
    setAccountId(accounts[0]?.id)
    setNote('')
    setDate(todayISO())
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  const resicoBreakdown = useMemo(() => {
    const gross = Number(grossAmount) || 0
    const ivaAmount = Math.round((gross * (Number(ivaPercent) || 0)) / 100)
    const isrAmount = Math.round((gross * (Number(isrPercent) || 0)) / 100)
    return { gross, ivaAmount, isrAmount, net: gross - ivaAmount - isrAmount }
  }, [grossAmount, ivaPercent, isrPercent])

  const hourlyAmount = useMemo(() => {
    if (payMode === 'hours') return (Number(hours) || 0) * (Number(hourlyRate) || 0)
    return Number(totalAmount) || 0
  }, [payMode, hours, hourlyRate, totalAmount])

  function handleSubmit(e) {
    e.preventDefault()
    if (profile.mode === 'resico') {
      if (!Number(grossAmount) || Number(grossAmount) <= 0) {
        setError('Ingresa el monto bruto')
        return
      }
      addIncome({ sourceId: profile.id, grossAmount, ivaPercent, isrPercent, accountId, note, date })
    } else if (profile.mode === 'hourly') {
      if (!hourlyAmount || hourlyAmount <= 0) {
        setError(payMode === 'hours' ? 'Ingresa horas y tarifa' : 'Ingresa el monto')
        return
      }
      addIncome({
        sourceId: profile.id,
        payMode,
        hours,
        hourlyRate,
        amount: totalAmount,
        accountId,
        note,
        date,
      })
    } else {
      if (!Number(fixedAmount) || Number(fixedAmount) <= 0) {
        setError('Ingresa el monto')
        return
      }
      addIncome({ sourceId: profile.id, amount: fixedAmount, accountId, note, date })
    }
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Agregar ingreso">
      <form onSubmit={handleSubmit} className="space-y-5">
        <SegmentedTabs
          className="w-full"
          tabs={incomeProfiles.map((p) => ({ value: p.id, label: p.label }))}
          value={sourceId}
          onChange={(v) => setSourceId(v)}
        />

        {profile.mode === 'resico' ? (
          <div className="space-y-4">
            <Input
              label="Monto bruto facturado"
              type="number"
              min="0"
              value={grossAmount}
              onChange={(e) => {
                setGrossAmount(e.target.value)
                if (error) setError('')
              }}
              error={error}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="IVA trasladado (%)"
                type="number"
                min="0"
                step="0.1"
                value={ivaPercent}
                onChange={(e) => setIvaPercent(e.target.value)}
              />
              <Input
                label="ISR RESICO (%)"
                type="number"
                min="0"
                step="0.1"
                value={isrPercent}
                onChange={(e) => setIsrPercent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 rounded-xl bg-surface2 p-3.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>IVA retenido</span>
                <span className="tabular-nums text-ink">−{formatMoney(resicoBreakdown.ivaAmount)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>ISR retenido</span>
                <span className="tabular-nums text-ink">−{formatMoney(resicoBreakdown.isrAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <span className="text-ink">Neto disponible</span>
                <span className="tabular-nums text-positive">{formatMoney(resicoBreakdown.net)}</span>
              </div>
            </div>
          </div>
        ) : profile.mode === 'hourly' ? (
          <div className="space-y-4">
            <SegmentedTabs
              className="w-full"
              tabs={[
                { value: 'hours', label: 'Por horas' },
                { value: 'total', label: 'Monto total' },
              ]}
              value={payMode}
              onChange={(v) => {
                setPayMode(v)
                if (error) setError('')
              }}
            />
            {payMode === 'hours' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Horas trabajadas" type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
                <Input
                  label="Tarifa por hora"
                  type="number"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>
            ) : (
              <Input
                label="Monto total del mes"
                type="number"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                error={error}
              />
            )}
            <div className="flex justify-between rounded-xl bg-surface2 p-3.5 text-sm font-semibold">
              <span className="text-ink">Total a registrar</span>
              <span className="tabular-nums text-positive">{formatMoney(hourlyAmount)}</span>
            </div>
          </div>
        ) : (
          <Input
            label="Monto"
            type="number"
            min="0"
            value={fixedAmount}
            onChange={(e) => {
              setFixedAmount(e.target.value)
              if (error) setError('')
            }}
            error={error}
          />
        )}

        <Select label="Depositar en" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          <Input label="Nota (opcional)" placeholder="Ej. Quincena" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Guardar ingreso
        </Button>
      </form>
    </Modal>
  )
}
