import { formatMoney } from '../../lib/format'

// Pesos enteros cuando se puede; con centavos solo si el monto los trae
// (p. ej. 357.50) — así la tabla no muestra ".00" en todo.
export const money = (amount) => formatMoney(amount, { cents: !Number.isInteger(Number(amount)) })

export const FREQUENCY_LABELS = { mensual: 'Mensual', semestral: 'Semestral', anual: 'Anual' }

// [15, 30] → "15 y 30"
export function formatDays(days) {
  if (!days?.length) return 'sin días'
  try {
    return new Intl.ListFormat('es-MX', { style: 'long', type: 'conjunction' }).format(days.map(String))
  } catch {
    return days.join(', ')
  }
}
