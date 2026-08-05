import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Wallet2 } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FinanceProvider } from './context/FinanceContext'
import { AppShell } from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Income from './pages/Income'
import Expenses from './pages/Expenses'
import Accounts from './pages/Accounts'
import Debts from './pages/Debts'
import Recurring from './pages/Recurring'
import Budgets from './pages/Budgets'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
      <div className="brand-gradient flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl shadow-glow">
        <Wallet2 className="h-7 w-7 text-white" />
      </div>
      <p className="text-sm text-muted">Cargando…</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { status, isAuthenticated } = useAuth()
  if (status === 'checking') return <SplashScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { status, isAuthenticated } = useAuth()
  if (status === 'checking') return <SplashScreen />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        element={
          <RequireAuth>
            <FinanceProvider>
              <AppShell />
            </FinanceProvider>
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ingresos" element={<Income />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/cuentas" element={<Accounts />} />
        <Route path="/deudas" element={<Debts />} />
        <Route path="/recurrentes" element={<Recurring />} />
        <Route path="/presupuestos" element={<Budgets />} />
        <Route path="/notificaciones" element={<Notifications />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
