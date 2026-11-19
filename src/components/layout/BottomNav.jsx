import { NavLink, useLocation } from 'react-router-dom'
import { BOTTOM_NAV_ITEMS, BUDGET_NAV_ITEMS, getAppMode } from '../../lib/nav'
import { cn } from '../../lib/cn'

export function BottomNav() {
  const { pathname } = useLocation()
  const items = getAppMode(pathname) === 'presupuesto' ? BUDGET_NAV_ITEMS : BOTTOM_NAV_ITEMS

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-brand-400' : 'text-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn('h-5 w-5 transition-transform duration-150', isActive && 'scale-110')}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
