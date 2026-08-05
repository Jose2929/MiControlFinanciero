import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, X, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useFinance } from '../context/FinanceContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Toggle } from '../components/ui/Toggle'
import { Avatar } from '../components/ui/Avatar'
import { IncomeProfileModal } from '../components/modals/IncomeProfileModal'
import { ICON_LIBRARY, CUSTOM_CATEGORY_SWATCHES } from '../lib/categories'
import { cn } from '../lib/cn'

function AddCategoryForm({ onAdd, onCancel }) {
  const [label, setLabel] = useState('')
  const [iconId, setIconId] = useState(ICON_LIBRARY[0].id)
  const [color, setColor] = useState(CUSTOM_CATEGORY_SWATCHES[0])

  function handleSubmit(e) {
    e.preventDefault()
    if (!label.trim()) return
    onAdd({ label: label.trim(), icon: iconId, color })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-line pt-4">
      <Input label="Nombre" placeholder="Ej. Mascotas" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />

      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Ícono</span>
        <div className="grid grid-cols-5 gap-2">
          {ICON_LIBRARY.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setIconId(id)}
              className={cn(
                'flex h-10 items-center justify-center rounded-lg border transition-colors',
                iconId === id ? 'border-brand-400 bg-brand-500/10' : 'border-line bg-surface2 hover:bg-line/50'
              )}
            >
              <Icon className="h-4.5 w-4.5 text-ink" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Color</span>
        <div className="flex flex-wrap gap-2">
          {CUSTOM_CATEGORY_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={cn(
                'h-8 w-8 rounded-full transition-all',
                color === swatch ? 'ring-2 ring-offset-2 ring-brand-400 ring-offset-surface' : 'opacity-80 hover:opacity-100'
              )}
              aria-label={swatch}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          Agregar
        </Button>
      </div>
    </form>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { customCategories, addCategory, removeCategory, incomeProfiles, updateIncomeProfile, removeIncomeProfile } =
    useFinance()
  const [addingCategory, setAddingCategory] = useState(false)
  const [notifyPayments, setNotifyPayments] = useState(true)
  const [notifyBudgets, setNotifyBudgets] = useState(true)
  const [profileModal, setProfileModal] = useState(null)

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
        <Avatar name={user?.name} size="xl" />
        <div>
          <p className="text-lg font-semibold text-ink">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Apariencia</h2>
        <Toggle
          checked={theme === 'dark'}
          onChange={toggleTheme}
          label={theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
          description="Cambia el tema visual de la aplicación"
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Notificaciones</h2>
        <div className="space-y-4">
          <Toggle
            checked={notifyPayments}
            onChange={setNotifyPayments}
            label="Pagos próximos"
            description="Avisos de deudas por vencer"
          />
          <Toggle
            checked={notifyBudgets}
            onChange={setNotifyBudgets}
            label="Presupuestos"
            description="Avisos al acercarte al límite"
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Perfiles de ingreso</h2>
          <Button variant="ghost" size="sm" onClick={() => setProfileModal({ type: 'create' })}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Cada perfil define cómo se calcula ese ingreso — agrega los que necesites, no solo los dos iniciales.
        </p>

        {incomeProfiles.length === 0 ? (
          <p className="text-sm text-muted">No tienes perfiles de ingreso configurados.</p>
        ) : (
          <div className="divide-y divide-line">
            {incomeProfiles.map((profile) => (
              <div key={profile.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{profile.label}</p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setProfileModal({ type: 'edit', profile })}
                      aria-label={`Editar ${profile.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIncomeProfile(profile.id)}
                      aria-label={`Eliminar ${profile.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {profile.mode === 'resico' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="IVA trasladado (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={profile.defaultIvaPercent}
                      onChange={(e) =>
                        updateIncomeProfile(profile.id, { defaultIvaPercent: Number(e.target.value) })
                      }
                    />
                    <Input
                      label="ISR RESICO (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={profile.defaultIsrPercent}
                      onChange={(e) =>
                        updateIncomeProfile(profile.id, { defaultIsrPercent: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                {profile.mode === 'hourly' && (
                  <Input
                    label="Tarifa por hora por defecto"
                    type="number"
                    min="0"
                    value={profile.defaultHourlyRate}
                    onChange={(e) =>
                      updateIncomeProfile(profile.id, { defaultHourlyRate: Number(e.target.value) })
                    }
                  />
                )}
                {profile.mode === 'fixed' && (
                  <Input
                    label="Monto fijo por defecto"
                    type="number"
                    min="0"
                    value={profile.defaultAmount || ''}
                    onChange={(e) =>
                      updateIncomeProfile(profile.id, { defaultAmount: Number(e.target.value) })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <IncomeProfileModal mode={profileModal} onClose={() => setProfileModal(null)} />

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Categorías personalizadas</h2>
          {!addingCategory && (
            <Button variant="ghost" size="sm" onClick={() => setAddingCategory(true)}>
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          )}
        </div>

        {customCategories.length > 0 && (
          <ul className="mt-3 space-y-1">
            {customCategories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${cat.color} 18%, transparent)`, color: cat.color }}
                >
                  <cat.icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{cat.label}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.id)}
                  aria-label={`Eliminar ${cat.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {addingCategory && (
          <AddCategoryForm
            onAdd={(cat) => {
              addCategory(cat)
              setAddingCategory(false)
            }}
            onCancel={() => setAddingCategory(false)}
          />
        )}
      </Card>

      <Button variant="danger" size="lg" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  )
}
