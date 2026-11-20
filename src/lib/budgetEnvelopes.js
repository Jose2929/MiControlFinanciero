// ---------------------------------------------------------------------------
// Sobres: cómo se liga un gasto registrado con una línea del plan.
// Lógica pura (sin React ni Firebase).
//
// El enlace son DOS datos, y solo uno vive en la operación:
//   · medio  → se DEDUCE de la cuenta de la operación (plan.accountMedios).
//   · sobre  → `envelopeId` en la operación = id de una línea del plan.
// Una operación sin `envelopeId` (todas las anteriores a esta función, las que
// registra la app de Android…) simplemente queda "sin sobre"; nada se migra.
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPE_LABELS = {
  debito: 'Débito',
  credito: 'Crédito',
  efectivo: 'Efectivo',
  ahorro: 'Ahorro',
}

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** Medio del presupuesto al que pertenece una cuenta, o null si está fuera. */
export function getAccountMedio(plan, accountId) {
  return plan?.accountMedios?.[accountId] || null
}

/**
 * Líneas del plan entre las que se puede elegir al registrar un gasto con esa
 * cuenta: las del mismo medio. Con una cuenta fuera del presupuesto (o de
 * Ahorro, de donde no se gasta) no hay nada que elegir.
 */
export function envelopeOptions(plan, accountId) {
  const medio = getAccountMedio(plan, accountId)
  if (!medio || medio === 'ahorro') return []
  return (plan.lines || []).filter((line) => line.medio === medio)
}

/**
 * Un gasto cuenta contra un sobre solo si es un gasto de verdad: no un pago de
 * tarjeta (`counterAccountId`), no uno convertido a MSI (esa deuda ya lo
 * absorbió) y con sobre asignado.
 */
export function countsTowardEnvelope(transaction) {
  return (
    transaction?.type === 'expense' &&
    !transaction.convertedToMsi &&
    !transaction.counterAccountId &&
    Boolean(transaction.envelopeId)
  )
}

/**
 * Sobre sugerido para un gasto nuevo. Nunca asigna solo: la pantalla lo deja
 * preseleccionado y el usuario lo confirma o lo cambia.
 *   1. historial: el sobre que más has usado en gastos de esa categoría con
 *      cuentas del mismo medio;
 *   2. nombre: el sobre que se llama igual que la categoría.
 *
 * @returns {{ lineId: string, reason: 'history' | 'name' } | null}
 */
export function suggestEnvelope({ plan, accountId, categoryId, categoryLabel, transactions = [] }) {
  const options = envelopeOptions(plan, accountId)
  if (options.length === 0) return null
  const optionIds = new Set(options.map((line) => line.id))

  const counts = new Map()
  for (const t of transactions) {
    if (!countsTowardEnvelope(t) || t.categoryId !== categoryId || !optionIds.has(t.envelopeId)) continue
    counts.set(t.envelopeId, (counts.get(t.envelopeId) || 0) + 1)
  }
  let best = null
  for (const line of options) {
    const count = counts.get(line.id) || 0
    if (count > 0 && (!best || count > best.count)) best = { lineId: line.id, count }
  }
  if (best) return { lineId: best.lineId, reason: 'history' }

  const wanted = normalizeText(categoryLabel)
  if (wanted) {
    const byName = options.find((line) => normalizeText(line.name) === wanted)
    if (byName) return { lineId: byName.id, reason: 'name' }
  }
  return null
}

/**
 * Propuesta de medio para las cuentas aún sin asignar, solo cuando no hay
 * ambigüedad (una sola candidata) y el medio todavía no tiene cuenta:
 *   · tdc2     → la cuenta cuyo nombre contiene "tdc2";
 *   · tdc      → la única cuenta de crédito;
 *   · debito   → la única de débito (que no sea la de tdc2);
 *   · efectivo → la única de efectivo;
 *   · ahorro   → la única de ahorro.
 * Con dudas no propone nada: es mejor que lo elija la persona.
 *
 * @returns {Object<string, string>} { [accountId]: medio }
 */
export function suggestAccountMedios(accounts, accountMedios = {}) {
  const free = accounts.filter((a) => !accountMedios[a.id])
  const taken = new Set(Object.values(accountMedios))
  const suggestions = {}

  const only = (candidates, medio) => {
    if (!taken.has(medio) && candidates.length === 1) {
      suggestions[candidates[0].id] = medio
      taken.add(medio)
      return candidates[0].id
    }
    return null
  }

  const tdc2Id = only(free.filter((a) => normalizeText(a.name).includes('tdc2')), 'tdc2')
  only(free.filter((a) => a.type === 'credito'), 'tdc')
  only(free.filter((a) => a.type === 'debito' && a.id !== tdc2Id && !normalizeText(a.name).includes('tdc2')), 'debito')
  only(free.filter((a) => a.type === 'efectivo'), 'efectivo')
  only(free.filter((a) => a.type === 'ahorro'), 'ahorro')
  return suggestions
}
