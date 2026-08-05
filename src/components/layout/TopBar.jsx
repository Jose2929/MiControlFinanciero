import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Wallet2 } from 'lucide-react'
import { getPageTitle } from '../../lib/nav'
import { useFinance } from '../../context/FinanceContext'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui/Avatar'
import { MoreMenu } from './MoreMenu'

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
