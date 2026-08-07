import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Wallet2, Save, Check, AlertCircle, RefreshCw, Users } from 'lucide-react'
import { getPageTitle } from '../../lib/nav'
import { useFinance } from '../../context/FinanceContext'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { MoreMenu } from './MoreMenu'

// Botón de guardado manual, presente en todas las secciones (vive en el TopBar).
// El estado se compromete en cada modal/edición; aquí se persiste el perfil
// completo a Firebase. Si tu pareja guardó algo más reciente que no has
// absorbido, en vez de guardar se abre un pequeño diálogo para elegir entre
// recargar sus cambios o sobrescribirlos con los tuyos.
function SaveButton() {
  const { dirty, saveState, lastSavedAt, saveProfile, discardLocalAndSyncRemote } = useFinance()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const saving = saveState === 'saving'
  const error = saveState === 'error'
  const conflict = saveState === 'conflict'
  // Se puede guardar si hay cambios, si nunca se ha guardado, o si falló.
  const canSave = dirty || error || !lastSavedAt

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  let label = 'Guardado'
  let Icon = Check
  if (saving) {
    label = 'Guardando información…'
  } else if (conflict) {
    label = 'Hay cambios nuevos'
    Icon = Users
  } else if (error) {
    label = 'Reintentar'
    Icon = AlertCircle
  } else if (dirty || !lastSavedAt) {
    // El guardado ya es automático — este botón queda como respaldo para
    // forzar un guardado inmediato (ej. justo antes de cerrar la pestaña).
    label = 'Cambios sin guardar'
    Icon = Save
  }

  function handleClick() {
    if (conflict) {
      setOpen((v) => !v)
      return
    }
    saveProfile().catch(() => {})
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant={conflict ? 'secondary' : canSave ? 'primary' : 'secondary'}
        size="sm"
        loading={saving}
        disabled={saving || (!canSave && !conflict)}
        onClick={handleClick}
        className="relative"
        aria-label={label}
      >
        {!saving && <Icon className="h-4 w-4" />}
        <span className="hidden sm:inline">{label}</span>
        {(dirty || conflict) && !saving && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-bg" />
        )}
      </Button>

      {open && conflict && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-soft">
          <p className="mb-3 text-xs text-muted">
            Tu pareja guardó cambios que aún no has visto. ¿Qué quieres hacer con tus ediciones sin guardar?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                discardLocalAndSyncRemote()
                setOpen(false)
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Recargar sus cambios (descarta los míos)
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                saveProfile({ force: true }).catch(() => {})
                setOpen(false)
              }}
            >
              <Save className="h-4 w-4" />
              Sobrescribir con los míos
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { unreadCount } = useFinance()
  const { user } = useAuth()
  const title = getPageTitle(location.pathname)

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3.5 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
          <Wallet2 className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-base font-semibold text-ink">{title}</span>
      </div>
      <h1 className="hidden text-lg font-semibold text-ink lg:block">{title}</h1>

      <div className="flex items-center gap-2">
        <SaveButton />
        <MoreMenu />
        <button
          type="button"
          onClick={() => navigate('/notificaciones')}
          aria-label="Notificaciones"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface2 hover:text-ink"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => navigate('/perfil')} aria-label="Perfil">
          <Avatar name={user?.name} size="sm" />
        </button>
      </div>
    </header>
  )
}
