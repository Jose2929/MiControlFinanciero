const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const currencyFormatterCents = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export function formatMoney(amount, { cents = false } = {}) {
  const value = Number(amount) || 0
  return cents ? currencyFormatterCents.format(value) : currencyFormatter.format(value)
}

export function formatSignedMoney(amount, { cents = false } = {}) {
  const value = Number(amount) || 0
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatMoney(Math.abs(value), { cents })}`
}

export function formatPercent(value, digits = 0) {
  return `${(Number(value) || 0).toFixed(digits)}%`
}

const dayFormatter = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const weekdayFormatter = new Intl.DateTimeFormat('es-MX', { weekday: 'long' })
const fullDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('es-MX', { month: 'short' })

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// String "YYYY-MM-DD" de un <input type="date"> -> Date a medianoche LOCAL.
// new Date("YYYY-MM-DD") lo interpreta como medianoche UTC (spec de JS), lo
// que en cualquier zona horaria detrás de UTC lo corre un día hacia atrás.
// Este helper es el único punto donde se debe parsear ese string.
export function parseDateInputValue(value) {
  if (value instanceof Date) return value
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(value)
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

// Date -> string "YYYY-MM-DD" en hora LOCAL, listo para un <input type="date">.
// (d.toISOString().slice(0,10) usa UTC y corre la fecha un día para adelante
// o atrás según la hora local del usuario — el mismo bug en el otro sentido.)
export function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysAgo(n, base = new Date()) {
  const d = startOfDay(base)
  d.setDate(d.getDate() - n)
  return d
}

export function daysFromNow(n, base = new Date()) {
  return daysAgo(-n, base)
}

export function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

export function periodKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(offset, base = new Date()) {
  const d = new Date(base)
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

export function monthEnd(offset, base = new Date()) {
  if (offset === 0) return startOfDay(base)
  const d = monthStart(offset - 1, base)
  d.setDate(d.getDate() - 1)
  return d
}

export function isInMonth(date, offset, base = new Date()) {
  const d = startOfDay(date).getTime()
  return d >= monthStart(offset, base).getTime() && d <= monthEnd(offset, base).getTime()
}

export function diffInDays(date, base = new Date()) {
  const a = startOfDay(date).getTime()
  const b = startOfDay(base).getTime()
  return Math.round((a - b) / 86400000)
}

export function formatGroupLabel(date) {
  const diff = diffInDays(date)
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  const weekday = weekdayFormatter.format(new Date(date))
  const day = dayFormatter.format(new Date(date))
  if (diff > -7 && diff < 0) {
    return `${capitalize(weekday)}`
  }
  return `${capitalize(weekday)}, ${day}`
}

export function formatShortDate(date) {
  return capitalize(dayFormatter.format(new Date(date)))
}

export function formatFullDate(date) {
  return capitalize(fullDateFormatter.format(new Date(date)))
}

export function formatMonthLabel(date) {
  return capitalize(monthFormatter.format(new Date(date)).replace('.', ''))
}

export function capitalize(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Urgency for upcoming debt payments / due dates.
// 'ok' = more than 7 days away, 'soon' = within 7 days, 'urgent' = within 3 days or overdue
export function getDueUrgency(dueDate) {
  const diff = diffInDays(dueDate)
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'urgent'
  if (diff <= 7) return 'soon'
  return 'ok'
}

export const URGENCY_LABELS = {
  overdue: 'Vencido',
  urgent: 'Vence pronto',
  soon: 'Próxima semana',
  ok: 'Sin prisa',
}

// Budget status by percentage used
export function getBudgetStatus(percentUsed) {
  if (percentUsed > 90) return 'danger'
  if (percentUsed >= 70) return 'warning'
  return 'ok'
}

export function formatRelativeDue(dueDate) {
  const diff = diffInDays(dueDate)
  if (diff < 0) return `Venció hace ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`
  if (diff === 0) return 'Vence hoy'
  if (diff === 1) return 'Vence mañana'
  return `Vence en ${diff} días`
}

export function initials(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
