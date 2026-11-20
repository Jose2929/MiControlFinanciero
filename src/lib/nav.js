import {
  LayoutDashboard,
  Receipt,
  Wallet,
  HandCoins,
  PiggyBank,
  User,
  TrendingUp,
  Repeat,
  Bell,
  CalendarDays,
  PieChart,
  SlidersHorizontal,
} from 'lucide-react'

// La app tiene dos apartados que comparten login, datos y botón de guardado:
//   · "registro"    — todo lo que ya existía (gastos, cuentas, deudas…).
//   · "presupuesto" — el plan por ciclos con sobres (rutas bajo /presupuesto).
// OJO: /presupuestos (plural) es la pantalla vieja de límites por categoría y
// pertenece a "registro"; por eso la comparación es exacta, no un startsWith
// a secas.
export const APP_MODES = [
  { id: 'registro', label: 'Registro' },
  { id: 'presupuesto', label: 'Presupuesto' },
]

export const MODE_HOME = {
  registro: '/dashboard',
  presupuesto: '/presupuesto',
}

export function getAppMode(pathname = '') {
  return pathname === '/presupuesto' || pathname.startsWith('/presupuesto/') ? 'presupuesto' : 'registro'
}

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

// Navegación del apartado Presupuesto — la usan tanto la barra inferior
// (celular) como el sidebar (escritorio). `end` evita que "Resumen" (que vive en
// /presupuesto) quede marcado también en /presupuesto/plan, etc.
export const BUDGET_NAV_ITEMS = [
  { to: '/presupuesto', label: 'Resumen', icon: PieChart, end: true },
  { to: '/presupuesto/sobres', label: 'Sobres', icon: Wallet },
  { to: '/presupuesto/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/presupuesto/plan', label: 'Plan', icon: SlidersHorizontal },
]

const PAGE_TITLES = {
  '/presupuesto': 'Resumen',
  '/presupuesto/sobres': 'Sobres',
  '/presupuesto/calendario': 'Calendario',
  '/presupuesto/plan': 'Plan del presupuesto',
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
