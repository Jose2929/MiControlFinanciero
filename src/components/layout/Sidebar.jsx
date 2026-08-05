import { NavLink } from 'react-router-dom'
import { Wallet2 } from 'lucide-react'
import { NAV_ITEMS } from '../../lib/nav'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui/Avatar'
import { cn } from '../../lib/cn'

export function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-glow">
          <Wallet2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-ink">Mi Control</p>
          <p className="text-sm font-semibold leading-tight text-ink">Financiero</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-brand-500/15 text-brand-300'
                  : 'text-muted hover:bg-surface2 hover:text-ink'
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/perfil"
        className="mx-3 mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface2 px-3 py-2.5 transition-colors hover:bg-line/60"
      >
        <Avatar name={user?.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
      </NavLink>
    </aside>
  )
}
