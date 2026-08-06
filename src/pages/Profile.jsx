import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  Plus,
  X,
  Pencil,
  Save,
  Download,
  Upload,
  Check,
  AlertCircle,
  Database,
  Users,
  Copy,
  UserPlus,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useFinance } from '../context/FinanceContext'
import { useHousehold } from '../context/HouseholdContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Toggle } from '../components/ui/Toggle'
import { Avatar } from '../components/ui/Avatar'
import { IncomeProfileModal } from '../components/modals/IncomeProfileModal'
import { AdjustBalanceModal } from '../components/modals/AdjustBalanceModal'
import { AddCategoryForm } from '../components/finance/AddCategoryForm'
import { formatFullDate, formatShortDate, formatSignedMoney } from '../lib/format'
import { cn } from '../lib/cn'

// Finanzas compartidas: quién ve/edita la misma información, invitar por código
// y unirse al hogar de tu pareja con el código que ella te comparta.
function HouseholdCard() {
  const { user } = useAuth()
  const { householdName, memberList, inviteCode, regenerateInviteCode, joinWithCode } = useHousehold()
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function handleGenerate() {
    setGenerating(true)
    setFeedback(null)
    try {
      // La suscripción en vivo de useHousehold() refleja el código nuevo
      // apenas se escribe en Firebase — no hace falta guardarlo aparte.
      await regenerateInviteCode()
      setCopied(false)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudo generar el código.' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFeedback({ type: 'error', text: 'No se pudo copiar. Selecciona el código manualmente.' })
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setFeedback(null)
    try {
      await joinWithCode(joinCode)
      setJoinCode('')
      setFeedback({ type: 'ok', text: 'Te uniste al hogar compartido.' })
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudo unir con ese código.' })
    } finally {
      setJoining(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-brand-400" />
        <h2 className="text-sm font-semibold text-ink">Finanzas compartidas</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Invita a tu pareja para que vea y edite la misma información financiera que tú.
      </p>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-muted">{householdName || 'Tu hogar'}</p>
        <ul className="space-y-2">
          {memberList.map((m) => (
            <li key={m.uid} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2">
              <Avatar name={m.name || m.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name || m.email}
                  {m.uid === user?.uid && ' (tú)'}
                </p>
                {m.email && <p className="truncate text-xs text-muted">{m.email}</p>}
              </div>
              {m.role === 'owner' && (
                <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-300">
                  Dueño
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4 border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium text-ink">Invitar a alguien</p>
        {inviteCode ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-surface2 px-3 py-2.5 text-center text-lg font-bold tracking-widest text-ink">
                {inviteCode}
              </code>
              <Button variant="secondary" size="icon" onClick={handleCopy} aria-label="Copiar código">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Generar nuevo código
            </button>
          </>
        ) : (
          <Button variant="secondary" loading={generating} onClick={handleGenerate}>
            <UserPlus className="h-4 w-4" />
            Generar código de invitación
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">
          Comparte este código con tu pareja — al capturarlo abajo, verá y podrá editar la misma información.
        </p>
      </div>

      <div className="border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium text-ink">Unirme con un código</p>
        <form onSubmit={handleJoin} className="flex items-center gap-2">
          <Input
            containerClassName="flex-1"
            placeholder="Ej. AB3F9K2X"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" variant="secondary" loading={joining} disabled={!joinCode.trim()}>
            Unirme
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Si tu pareja ya tiene un hogar, pide su código y captúralo aquí para compartir su información.
        </p>
      </div>

      {feedback && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
            feedback.type === 'ok' ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'
          )}
        >
          {feedback.type === 'ok' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </Card>
  )
}

// Ajustar saldo: corrige cuánto tienes en una cuenta para partir de un punto
// realista (p.ej. arrancar a medio mes con el ingreso ya recibido y gastado).
// Las transacciones 'adjustment' no aparecen en Ingresos ni Gastos (que
// filtran por tipo exacto), así que se listan aquí para no perderles el
// rastro.
function AdjustBalanceCard() {
  const { transactions, accounts } = useFinance()
  const [open, setOpen] = useState(false)

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const adjustments = transactions.filter((t) => t.type === 'adjustment').sort((a, b) => b.date - a.date)

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-ink">Ajustar saldo</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajustar
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Corrige cuánto tienes en una cuenta ahora mismo — útil para arrancar a medio mes cuando el ingreso ya
        llegó y en parte ya se gastó.
      </p>

      {adjustments.length > 0 && (
        <ul className="divide-y divide-line">
          {adjustments.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{tx.note}</p>
                <p className="text-xs text-muted">
                  {accountMap[tx.accountId]?.name || 'Cuenta eliminada'} · {formatShortDate(tx.date)}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 font-semibold tabular-nums',
                  tx.amount >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                {formatSignedMoney(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AdjustBalanceModal open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}

// Descarga un texto como archivo local.
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Sección de datos: guardar manualmente, exportar el JSON completo del perfil
// e importar un JSON para restaurarlo.
function DataBackupCard() {
  const { saveProfile, exportProfile, importProfile, dirty, saveState, lastSavedAt } = useFinance()
  const fileRef = useRef(null)
  const [feedback, setFeedback] = useState(null) // { type: 'ok' | 'error', text }

  const savedLabel = lastSavedAt
    ? `Último guardado: ${formatFullDate(lastSavedAt)}`
    : 'Aún no has guardado este perfil'

  function handleExport() {
    try {
      downloadText('mi-control-financiero.json', exportProfile())
      setFeedback({ type: 'ok', text: 'JSON exportado.' })
    } catch (err) {
      setFeedback({ type: 'error', text: `No se pudo exportar: ${err.message}` })
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar el mismo archivo
    if (!file) return
    try {
      const text = await file.text()
      importProfile(text)
      setFeedback({ type: 'ok', text: 'Perfil importado. Presiona Guardar para persistirlo.' })
    } catch (err) {
      setFeedback({ type: 'error', text: `JSON inválido: ${err.message}` })
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-brand-400" />
        <h2 className="text-sm font-semibold text-ink">Datos y respaldo</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Guarda tu información, expórtala como un archivo JSON o restaura un perfil desde un JSON.
      </p>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-surface2 px-3 py-2.5">
        <span className="text-xs text-muted">{savedLabel}</span>
        {dirty && (
          <span className="flex items-center gap-1 text-xs font-medium text-warning">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Sin guardar
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          variant="primary"
          loading={saveState === 'saving'}
          disabled={saveState === 'saving'}
          onClick={() => saveProfile().catch(() => setFeedback({ type: 'error', text: 'No se pudo guardar.' }))}
        >
          <Save className="h-4 w-4" />
          Guardar ahora
        </Button>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exportar JSON
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Importar JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {feedback && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
            feedback.type === 'ok' ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'
          )}
        >
          {feedback.type === 'ok' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </Card>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { customCategories, addCategory, removeCategory, incomeProfiles, updateIncomeProfile, removeIncomeProfile } =
    useFinance()
  const [addingCategory, setAddingCategory] = useState(false)
  const [notifyPayments, setNotifyPayments] = useState(true)
  const [notifyBudgets, setNotifyBudgets] = useState(true)
  const [profileModal, setProfileModal] = useState(null)

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
        <Avatar name={user?.name} size="xl" />
        <div>
          <p className="text-lg font-semibold text-ink">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
      </Card>

      <HouseholdCard />

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Apariencia</h2>
        <Toggle
          checked={theme === 'dark'}
          onChange={toggleTheme}
          label={theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
          description="Cambia el tema visual de la aplicación"
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Notificaciones</h2>
        <div className="space-y-4">
          <Toggle
            checked={notifyPayments}
            onChange={setNotifyPayments}
            label="Pagos próximos"
            description="Avisos de deudas por vencer"
          />
          <Toggle
            checked={notifyBudgets}
            onChange={setNotifyBudgets}
            label="Presupuestos"
            description="Avisos al acercarte al límite"
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Perfiles de ingreso</h2>
          <Button variant="ghost" size="sm" onClick={() => setProfileModal({ type: 'create' })}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Cada perfil define cómo se calcula ese ingreso — agrega los que necesites, no solo los dos iniciales.
        </p>

        {incomeProfiles.length === 0 ? (
          <p className="text-sm text-muted">No tienes perfiles de ingreso configurados.</p>
        ) : (
          <div className="divide-y divide-line">
            {incomeProfiles.map((profile) => (
              <div key={profile.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{profile.label}</p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setProfileModal({ type: 'edit', profile })}
                      aria-label={`Editar ${profile.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIncomeProfile(profile.id)}
                      aria-label={`Eliminar ${profile.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {profile.mode === 'resico' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="IVA trasladado (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={profile.defaultIvaPercent}
                      onChange={(e) =>
                        updateIncomeProfile(profile.id, { defaultIvaPercent: Number(e.target.value) })
                      }
                    />
                    <Input
                      label="ISR RESICO (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={profile.defaultIsrPercent}
                      onChange={(e) =>
                        updateIncomeProfile(profile.id, { defaultIsrPercent: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                {profile.mode === 'hourly' && (
                  <Input
                    label="Tarifa por hora por defecto"
                    type="number"
                    min="0"
                    value={profile.defaultHourlyRate}
                    onChange={(e) =>
                      updateIncomeProfile(profile.id, { defaultHourlyRate: Number(e.target.value) })
                    }
                  />
                )}
                {profile.mode === 'fixed' && (
                  <Input
                    label="Monto fijo por defecto"
                    type="number"
                    min="0"
                    value={profile.defaultAmount || ''}
                    onChange={(e) =>
                      updateIncomeProfile(profile.id, { defaultAmount: Number(e.target.value) })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <IncomeProfileModal mode={profileModal} onClose={() => setProfileModal(null)} />

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Categorías personalizadas</h2>
          {!addingCategory && (
            <Button variant="ghost" size="sm" onClick={() => setAddingCategory(true)}>
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          )}
        </div>

        {customCategories.length > 0 && (
          <ul className="mt-3 space-y-1">
            {customCategories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${cat.color} 18%, transparent)`, color: cat.color }}
                >
                  <cat.icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{cat.label}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.id)}
                  aria-label={`Eliminar ${cat.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negative-soft hover:text-negative"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {addingCategory && (
          <AddCategoryForm
            onAdd={(cat) => {
              addCategory(cat)
              setAddingCategory(false)
            }}
            onCancel={() => setAddingCategory(false)}
          />
        )}
      </Card>

      <AdjustBalanceCard />

      <DataBackupCard />

      <Button variant="danger" size="lg" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  )
}
