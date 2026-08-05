import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { SegmentedTabs } from '../components/ui/SegmentedTabs'
import { GoogleIcon } from '../components/GoogleIcon'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, register, pendingProvider } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('jmrm.2929@gmail.com')
  const [password, setPassword] = useState('••••••••')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'signin') await signIn()
    else await register()
    navigate('/dashboard')
  }

  async function handleGoogle() {
    await signInWithGoogle()
    navigate('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand-700/20 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl shadow-glow">
            <Wallet2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">Mi Control Financiero</h1>
            <p className="mt-1 text-sm text-muted">Ingresos, gastos y deudas en un solo lugar</p>
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          <SegmentedTabs
            className="mb-6 w-full"
            tabs={[
              { value: 'signin', label: 'Entrar' },
              { value: 'signup', label: 'Crear cuenta' },
            ]}
            value={mode}
            onChange={setMode}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
            />
            <div>
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[38px] text-muted transition-colors hover:text-ink"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signin' && (
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="mt-2 inline-block text-xs font-medium text-brand-400 hover:text-brand-300"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={pendingProvider === 'email'}
              disabled={pendingProvider === 'google'}
            >
              {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">o</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            loading={pendingProvider === 'google'}
            disabled={pendingProvider === 'email'}
          >
            {pendingProvider !== 'google' && <GoogleIcon className="h-4.5 w-4.5" />}
            Continuar con Google
          </Button>
        </Card>

        <p className="mt-6 text-center text-xs text-muted">
          Interfaz de demostración con datos de ejemplo — sin conexión a servicios reales.
        </p>
      </div>
    </div>
  )
}
