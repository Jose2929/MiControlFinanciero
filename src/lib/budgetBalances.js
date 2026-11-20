// ---------------------------------------------------------------------------
// Saldos de los sobres por ciclo. Lógica pura (sin React ni Firebase).
//
// Modelo ("todo acumula", arranque en $0):
//
//   saldo al cierre = arrastre + asignado del ciclo − gastado en el ciclo
//   arrastre del ciclo siguiente = saldo al cierre del anterior
//
// El primer ciclo (settings.startCycle) arranca con arrastre 0. Lo "asignado"
// de cada ciclo es el monto mensual de la línea del plan; lo "gastado" sale de
// las operaciones registradas con ese sobre (`envelopeId`), en las fechas del
// ciclo. Como el resto de la app, el monto de una línea NO se versiona por
// mes: cambiarlo cambia el cálculo de todos los ciclos.
// ---------------------------------------------------------------------------

import {
  cycleFromKey,
  expectedSpend,
  getCycleForDate,
  getCycleProgress,
  isDateInCycle,
  shiftCycle,
  weeklyAllowance,
} from './budget'
import { countsTowardEnvelope, envelopeOptions, getAccountMedio, suggestEnvelope } from './budgetEnvelopes'

// Líneas que funcionan como sobre o bolsillo. Los cargos de la TDC y los
// ahorros programados no son sobres: no se gastan "contra" ellos.
const ENVELOPE_KINDS = ['sobre', 'fondo', 'bolsillo']

// Medios de donde sale gasto diario; una operación sin sobre en uno de estos
// medios es la que conviene clasificar.
const SPENDING_MEDIOS = ['debito', 'efectivo', 'tdc2']

const MAX_CYCLES = 240 // tope de seguridad: 20 años

const roundCents = (n) => Math.round(n * 100) / 100

export function isEnvelopeLine(line) {
  return ENVELOPE_KINDS.includes(line.kind)
}

/** Ciclos desde `from` hasta `to` (ambos incluidos). Vacío si `to` es anterior. */
export function cyclesBetween(from, to) {
  const cycles = []
  let cycle = from
  while (cycle.start <= to.start && cycles.length < MAX_CYCLES) {
    cycles.push(cycle)
    cycle = shiftCycle(cycle, 1)
  }
  return cycles
}

/** Rango de ciclos que se pueden ver: del ciclo de arranque al ciclo de hoy. null si falta el arranque. */
export function cycleRange(plan, today = new Date()) {
  const startDay = plan.settings.cycleStartDay
  const first = cycleFromKey(plan.settings.startCycle, startDay)
  if (!first) return null
  const current = getCycleForDate(today, startDay)
  // Si el arranque es en el futuro, el rango es solo ese ciclo (aún sin gasto).
  const last = current.start < first.start ? first : current
  return { first, current, last }
}

function statusFor({ balance, spent, expected }) {
  if (balance < 0) return 'danger'
  if (spent > expected) return 'warning'
  return 'ok'
}

/**
 * Saldo de cada sobre/bolsillo en el ciclo `cycle` (con todo lo que arrastra
 * desde el ciclo de arranque).
 *
 * @returns {null | {
 *   items: Array, spendTotals: {assigned, spent, balance}, isCurrent: boolean, isPast: boolean
 * }} null si todavía no se eligió el ciclo de arranque o `cycle` es anterior a él.
 */
export function computeEnvelopes({ plan, transactions = [], cycle, today = new Date() }) {
  const startDay = plan.settings.cycleStartDay
  const first = cycleFromKey(plan.settings.startCycle, startDay)
  if (!first || cycle.start < first.start) return null

  const cycles = cyclesBetween(first, cycle)
  const progress = getCycleProgress(cycle, today)

  // Gastado por sobre y por ciclo, en una sola pasada por las operaciones.
  const spent = new Map() // envelopeId → Map(cycleKey → monto, en centavos)
  for (const t of transactions) {
    if (!countsTowardEnvelope(t)) continue
    const key = getCycleForDate(t.date, startDay).key
    if (key < first.key || key > cycle.key) continue
    if (!spent.has(t.envelopeId)) spent.set(t.envelopeId, new Map())
    const byCycle = spent.get(t.envelopeId)
    byCycle.set(key, (byCycle.get(key) || 0) + Math.round(Number(t.amount) * 100))
  }

  const items = plan.lines.filter(isEnvelopeLine).map((line) => {
    const sinceKey = line.since && line.since > first.key ? line.since : first.key
    const byCycle = spent.get(line.id)
    let opening = 0 // en centavos
    let assigned = 0
    let spentNow = 0
    for (const c of cycles) {
      assigned = c.key >= sinceKey ? Math.round(line.amount * 100) : 0
      spentNow = byCycle?.get(c.key) || 0
      if (c !== cycles[cycles.length - 1]) opening = opening + assigned - spentNow
    }
    const balance = opening + assigned - spentNow

    const item = {
      line,
      opening: opening / 100,
      assigned: assigned / 100,
      spent: spentNow / 100,
      balance: balance / 100,
    }
    item.expected = expectedSpend(item.assigned, cycle, today)
    item.paceDiff = roundCents(item.spent - item.expected)
    item.perWeek = progress.status === 'current' ? weeklyAllowance(item.balance, cycle, today) : 0
    item.status = statusFor(item)
    return item
  })

  // Totales de lo que se gasta a diario (sobres + fondo general); los bolsillos
  // acumulan para cobros futuros y no cuentan aquí.
  const daily = items.filter((i) => i.line.kind !== 'bolsillo')
  const sum = (key) => roundCents(daily.reduce((s, i) => s + i[key], 0))

  return {
    items,
    spendTotals: { assigned: sum('assigned'), spent: sum('spent'), balance: sum('balance'), opening: sum('opening') },
    isCurrent: progress.status === 'current',
    isPast: progress.status === 'past',
    progress,
  }
}

/**
 * Gastos del ciclo que aún no tienen sobre (o cuyo sobre ya no existe en el
 * plan), solo de cuentas de donde sale gasto diario (débito, efectivo, TDC2).
 * Los cargos de la TDC no se piden: son los fijos y se concilian aparte.
 *
 * Cada elemento trae los sobres posibles y, si hay, el sugerido.
 */
export function findUnclassified({ plan, transactions = [], cycle, categoryLabelOf = () => '' }) {
  const lineIds = new Set(plan.lines.filter(isEnvelopeLine).map((l) => l.id))
  const items = []
  for (const t of transactions) {
    if (t.type !== 'expense' || t.convertedToMsi || t.counterAccountId) continue
    if (!isDateInCycle(t.date, cycle)) continue
    if (!SPENDING_MEDIOS.includes(getAccountMedio(plan, t.accountId))) continue
    if (t.envelopeId && lineIds.has(t.envelopeId)) continue
    const options = envelopeOptions(plan, t.accountId)
    if (options.length === 0) continue
    items.push({
      transaction: t,
      options,
      suggestion: suggestEnvelope({
        plan,
        accountId: t.accountId,
        categoryId: t.categoryId,
        categoryLabel: categoryLabelOf(t.categoryId),
        transactions,
      }),
    })
  }
  return items.sort((a, b) => new Date(b.transaction.date) - new Date(a.transaction.date))
}
