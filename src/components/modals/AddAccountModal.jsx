import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useFinance } from '../../context/FinanceContext'
import { cn } from '../../lib/cn'

const GRADIENTS = [
  { id: 'blue', cls: 'from-sky-600 via-blue-700 to-indigo-900' },
  { id: 'violet', cls: 'from-violet-600 via-purple-700 to-fuchsia-900' },
  { id: 'rose', cls: 'from-rose-600 via-red-700 to-red-950' },
  { id: 'emerald', cls: 'from-emerald-600 via-emerald-700 to-teal-900' },
  { id: 'amber', cls: 'from-amber-500 via-orange-600 to-orange-900' },
  { id: 'slate', cls: 'from-slate-600 via-slate-700 to-slate-900' },
]

export function AddAccountModal({ open, onClose }) {
  const { addAccount } = useFinance()
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [type, setType] = useState('debito')
  const [last4, setLast4] = useState('')
  const [balance, setBalance] = useState('')
  const [limit, setLimit] = useState('')
  const [used, setUsed] = useState('')
  const [goal, setGoal] = useState('')
  const [gradient, setGradient] = useState(GRADIENTS[0].cls)

  function reset() {
    setName('')
    setBank('')
    setType('debito')
    setLast4('')
    setBalance('')
    setLimit('')
    setUsed('')
    setGoal('')
    setGradient(GRADIENTS[0].cls)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    addAccount({
      name: name.trim(),
      bank: bank.trim() || null,
      type,
      last4: type === 'efectivo' ? null : last4.trim() || null,
      balance: type !== 'credito' ? Number(balance) || 0 : undefined,
      limit: type === 'credito' ? Number(limit) || 0 : undefined,
      used: type === 'credito' ? Number(used) || 0 : undefined,
      goal: type === 'ahorro' ? Number(goal) || 0 : undefined,
      gradient,
    })
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Agregar cuenta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre de la cuenta"
          placeholder="Ej. Tarjeta HSBC"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Banco (opcional)" placeholder="Ej. HSBC" value={bank} onChange={(e) => setBank(e.target.value)} />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="efectivo">Efectivo</option>
            <option value="ahorro">Ahorro</option>
          </Select>
        </div>

        {type !== 'efectivo' && (
          <Input
            label="Últimos 4 dígitos"
            placeholder="0000"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
          />
        )}

        {type === 'credito' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Límite de crédito" type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <Input label="Saldo usado" type="number" min="0" value={used} onChange={(e) => setUsed(e.target.value)} />
          </div>
        ) : (
          <Input
            label={type === 'ahorro' ? 'Saldo actual' : 'Saldo disponible'}
            type="number"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        )}

        {type === 'ahorro' && (
          <Input
            label="Meta de ahorro (opcional)"
            type="number"
            min="0"
            placeholder="Ej. 30000"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        )}

        <div>
          <span className="mb-2 block text-sm font-medium text-ink">Color</span>
          <div className="flex flex-wrap gap-2.5">
            {GRADIENTS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGradient(g.cls)}
                className={cn(
                  'h-9 w-9 rounded-full bg-gradient-to-br transition-all duration-150',
                  g.cls,
                  gradient === g.cls ? 'ring-2 ring-offset-2 ring-brand-400 ring-offset-surface' : 'opacity-80 hover:opacity-100'
                )}
                aria-label={g.id}
              />
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full">
          Guardar cuenta
        </Button>
      </form>
    </Modal>
  )
}
