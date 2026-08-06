import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ICON_LIBRARY, CUSTOM_CATEGORY_SWATCHES } from '../../lib/categories'
import { cn } from '../../lib/cn'

// Alta de categoría personalizada — usado en Perfil (gestión general de
// categorías) y en el modal de presupuesto (alta rápida sin salir del flujo).
export function AddCategoryForm({ onAdd, onCancel }) {
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
