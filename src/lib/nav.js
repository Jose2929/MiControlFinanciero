import { LayoutDashboard, Receipt, Wallet, HandCoins, PiggyBank, User, TrendingUp, Repeat, Bell } from 'lucide-react'

// Full set — used by the desktop sidebar.
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/deudas', label: 'Deudas', icon: HandCoins },
  { to: '/recurrentes', label: 'Recurrentes', icon: Repeat },
  { to: '/presupuestos', label: 'Presupuestos', icon: PiggyBank },
  { to: '/perfil', label: 'Perfil', icon: User },
]

// Mobile bottom nav keeps only the 5 primary destinations.
export const BOTTOM_NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/presupuestos', label: 'Presupuestos', icon: PiggyBank },
  { to: '/deudas', label: 'Deudas', icon: HandCoins },
  { to: '/perfil', label: 'Perfil', icon: User },
]

// Sections that live outside the primary sidebar/bottom-nav destinations —
// surfaced through the "Más" dropdown in TopBar so they're reachable on
// every breakpoint without crowding the 5-item mobile bottom nav.
export const MORE_MENU_ITEMS = [
  { to: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/recurrentes', label: 'Recurrentes', icon: Repeat },
  { to: '/notificaciones', label: 'Notificaciones', icon: Bell },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/ingresos': 'Ingresos',
  '/gastos': 'Gastos',
  '/cuentas': 'Cuentas y tarjetas',
  '/deudas': 'Deudas y créditos',
  '/recurrentes': 'Pagos recurrentes',
  '/presupuestos': 'Presupuestos',
  '/notificaciones': 'Notificaciones',
  '/perfil': 'Perfil',
}

export function getPageTitle(pathname) {
  return PAGE_TITLES[pathname] || 'Mi Control Financiero'
}
