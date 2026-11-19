import { useLocation, useNavigate } from 'react-router-dom'
import { APP_MODES, MODE_HOME, getAppMode } from '../../lib/nav'
import { cn } from '../../lib/cn'

// Selector fijo Registro | Presupuesto. Vive en el TopBar, así que está a la
// vista en todas las pantallas y en cualquier tamaño de pantalla.
export function ModeSwitch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = getAppMode(pathname)

  return (
    <div
      role="tablist"
      aria-label="Apartado de la app"
      className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1 sm:inline-grid sm:w-80"
    >
      {APP_MODES.map((mode) => {
        const active = mode.id === current
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) navigate(MODE_HOME[mode.id])
            }}
            className={cn(
              'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150',
              active ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
            )}
          >
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
