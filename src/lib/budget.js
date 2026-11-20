// ---------------------------------------------------------------------------
// Presupuesto por ciclos — lógica pura (sin React ni Firebase).
//
// Todo lo que calcula la sección "Presupuesto" vive aquí para poder probarlo
// con Vitest sin montar pantallas: ciclos, ritmo de gasto, cuadre del plan,
// plan por quincena y bolsillos.
//
// Convenciones:
//   · Las fechas son SIEMPRE locales (medianoche), igual que format.js — nunca
//     se mezcla con UTC.
//   · Los montos se suman en CENTAVOS enteros para que 357.50 + 139 no arrastre
//     errores de coma flotante; solo al final se regresan a pesos.
//
// Forma del plan (se guarda aparte del perfil, ver la propuesta de la Fase 2):
//   {
//     version, settings,
//     incomes: [{ id, name, amount, payDays: [15, 30], covers: ['tdc', ...] }],
//     lines:   [{ id, medio, kind, name, amount, payDay, payFrequency, isValve }],
//   }
//   `amount` de una línea es SIEMPRE el monto mensual (en bolsillos, lo que se
//   aparta cada mes). `kind` ∈ cargo | bolsillo | fondo | sobre | ahorro.
// ---------------------------------------------------------------------------

import { startOfDay, diffInDays } from './format'

export const MEDIO_ORDER = ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro']

export const MEDIO_LABELS = {
  tdc: 'TDC',
  tdc2: 'TDC2',
  debito: 'Débito',
  efectivo: 'Efectivo',
  ahorro: 'Ahorro',
}

export const MEDIO_DESCRIPTIONS = {
  tdc: 'Tarjeta de crédito · solo cargos fijos, se paga completa',
  tdc2: 'Débito con bolsillos · se aparta cada mes',
  debito: 'Cuenta de gasto diario',
  efectivo: 'Se retira de la cuenta de débito',
  ahorro: 'Ahorros programados',
}

// Cada cuántos meses se paga realmente un bolsillo (para saber cuánto se
// junta antes de que llegue el cobro).
export const PAY_FREQUENCY_MONTHS = { mensual: 1, semestral: 6, anual: 12 }

export const DEFAULT_SETTINGS = {
  // Día en que arranca el ciclo de gasto diario. 1 = mes calendario; 15 = del
  // 15 al 14 del siguiente mes.
  cycleStartDay: 1,
  cutDay: 3,
  // Fecha límite de pago de la TDC (día del mes) — configurable.
  payDueDay: 3,
  // Día de sueldo en que se reparte lo de TDC2, débito y efectivo.
  spendTransferDay: 15,
  // En cuántas partes se retira el efectivo del débito.
  cashWithdrawalParts: 2,
  // Primer ciclo que cuenta para los sobres, como "AAAA-MM" (el mes en que
  // EMPIEZA ese ciclo). Los saldos arrancan en $0 ahí y acumulan hacia
  // adelante. null = aún no se elige (la pantalla Sobres lo pide).
  startCycle: null,
}

// `accountMedios` liga cada cuenta de la app (por id) con su medio del
// presupuesto: { 'acc-1001': 'tdc', ... }. Una cuenta que no aparece ahí queda
// fuera del presupuesto. Es configuración del hogar, no parte del plan que se
// exporta/importa.
// `categoryEnvelopes` liga categorías con sobres, POR MEDIO:
//   { debito: { comida: 'debito-mandado', '*': 'debito-gasolina' }, ... }
// La clave '*' es "todo lo demás" de ese medio. `adjustments` son los conteos
// físicos ("este sobre tiene en realidad $X"). Los tres —cuentas, ligas y
// ajustes— son configuración e historial del hogar, no parte del plan que se
// exporta/importa.
export function createEmptyPlan() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    incomes: [],
    lines: [],
    accountMedios: {},
    categoryEnvelopes: {},
    adjustments: [],
  }
}

// -- Dinero (centavos enteros) ----------------------------------------------

const toCents = (n) => Math.round((Number(n) || 0) * 100)
const fromCents = (c) => c / 100

// Parte un monto en `parts` partes iguales sin perder centavos: si no divide
// exacto, las primeras partes llevan el centavo extra.
export function splitAmount(total, parts) {
  const n = Math.max(1, Math.floor(Number(parts)) || 1)
  const cents = toCents(total)
  const base = Math.floor(cents / n)
  const extra = cents - base * n
  return Array.from({ length: n }, (_, i) => fromCents(base + (i < extra ? 1 : 0)))
}

export function sumLines(lines, predicate = () => true) {
  return fromCents(lines.filter(predicate).reduce((sum, l) => sum + toCents(l.amount), 0))
}

// -- Ciclos -----------------------------------------------------------------

function normalizeStartDay(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.cycleStartDay
  return Math.min(Math.max(n, 1), 31)
}

// Día `day` de un mes, recortado al último día si ese mes no lo tiene (el día
// 30 no existe en febrero). `month` puede salirse de 0-11: Date lo normaliza.
export function clampedDate(year, month, day) {
  const first = new Date(year, month, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, lastDay))
}

function buildCycle(year, month, startDayInput) {
  const startDay = normalizeStartDay(startDayInput)
  const first = new Date(year, month, 1)
  const y = first.getFullYear()
  const m = first.getMonth()
  const start = clampedDate(y, m, startDay)
  const nextStart = clampedDate(y, m + 1, startDay)
  const end = new Date(nextStart)
  end.setDate(end.getDate() - 1)
  return {
    // Identifica el ciclo por el mes en que EMPIEZA ("2026-11").
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    startDay,
    start,
    // Último día incluido del ciclo.
    end,
    days: diffInDays(nextStart, start),
  }
}

// Ciclo que contiene `date`.
export function getCycleForDate(date = new Date(), startDay = DEFAULT_SETTINGS.cycleStartDay) {
  const d = startOfDay(date)
  const startThisMonth = clampedDate(d.getFullYear(), d.getMonth(), normalizeStartDay(startDay))
  const month = d >= startThisMonth ? d.getMonth() : d.getMonth() - 1
  return buildCycle(d.getFullYear(), month, startDay)
}

/** Ciclo que lleva la clave "AAAA-MM" (el mes en que empieza), o null si la clave no es válida. */
export function cycleFromKey(key, startDay = DEFAULT_SETTINGS.cycleStartDay) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key || '')
  if (!match) return null
  return buildCycle(Number(match[1]), Number(match[2]) - 1, startDay)
}

// n = -1 → ciclo anterior, +1 → siguiente.
export function shiftCycle(cycle, n) {
  return buildCycle(cycle.start.getFullYear(), cycle.start.getMonth() + n, cycle.startDay)
}

export function isDateInCycle(date, cycle) {
  const d = startOfDay(date)
  return d >= cycle.start && d <= cycle.end
}

// -- Ritmo del ciclo --------------------------------------------------------

/**
 * Dónde va `today` dentro del ciclo.
 *   · dayNumber: día N del ciclo contando hoy (0 si aún no empieza, total si ya
 *     terminó) — sirve para el ritmo esperado de gasto.
 *   · daysLeft: días que quedan CONTANDO hoy (el dinero de hoy aún se puede
 *     gastar) — sirve para el aproximado por semana.
 */
export function getCycleProgress(cycle, today = new Date()) {
  const t = startOfDay(today)
  const totalDays = cycle.days
  if (t < cycle.start) {
    return { status: 'future', totalDays, dayNumber: 0, daysLeft: totalDays, weeksLeft: totalDays / 7 }
  }
  if (t > cycle.end) {
    return { status: 'past', totalDays, dayNumber: totalDays, daysLeft: 0, weeksLeft: 0 }
  }
  const dayNumber = diffInDays(t, cycle.start) + 1
  const daysLeft = totalDays - dayNumber + 1
  return { status: 'current', totalDays, dayNumber, daysLeft, weeksLeft: daysLeft / 7 }
}

// Cuánto se esperaría llevar gastado al cierre de hoy si se gastara parejo.
export function expectedSpend(assigned, cycle, today = new Date()) {
  const { dayNumber, totalDays } = getCycleProgress(cycle, today)
  return fromCents(Math.round((toCents(assigned) * dayNumber) / totalDays))
}

// Aproximado por semana restante. Si queda menos de una semana, todo el saldo
// cuenta como "la semana" (no se infla dividiendo entre una fracción). Con el
// ciclo terminado regresa 0. Si el saldo es negativo, regresa negativo.
export function weeklyAllowance(balance, cycle, today = new Date()) {
  const { daysLeft } = getCycleProgress(cycle, today)
  if (daysLeft <= 0) return 0
  const weeks = Math.max(daysLeft / 7, 1)
  return fromCents(Math.round(toCents(balance) / weeks))
}

// -- Cuadre del plan --------------------------------------------------------

export function totalsByMedio(plan) {
  const totals = {}
  for (const medio of MEDIO_ORDER) {
    totals[medio] = sumLines(plan.lines, (l) => l.medio === medio)
  }
  return totals
}

/**
 * ¿Cuadra el plan? Cada ingreso cubre ciertos medios (`covers`); lo que sobra
 * (o falta) por ingreso es `remaining`. Una línea cuyo medio no cubre ningún
 * ingreso cuenta como `uncovered` y rompe el cuadre.
 */
export function checkBalance(plan) {
  const incomes = plan.incomes.map((income) => {
    const assigned = sumLines(plan.lines, (l) => income.covers?.includes(l.medio))
    const remaining = fromCents(toCents(income.amount) - toCents(assigned))
    return {
      id: income.id,
      name: income.name,
      amount: Number(income.amount) || 0,
      assigned,
      remaining,
      balanced: remaining === 0,
    }
  })
  const uncovered = sumLines(plan.lines, (l) => !plan.incomes.some((i) => i.covers?.includes(l.medio)))
  const totalIncome = sumLines(incomes.map((i) => ({ amount: i.amount })))
  const totalAssigned = sumLines(plan.lines)
  return {
    incomes,
    uncovered,
    totalIncome,
    totalAssigned,
    remaining: fromCents(toCents(totalIncome) - toCents(totalAssigned)),
    balanced: uncovered === 0 && incomes.length > 0 && incomes.every((i) => i.balanced),
  }
}

// -- Plan por quincena ------------------------------------------------------

/**
 * Transferencias de cada día de sueldo del ingreso que paga los gastos (el que
 * cubre 'tdc'). En el día `spendTransferDay` se reparte a TDC2, débito y
 * efectivo (este último sale del débito, en partes); lo que queda en cada
 * sueldo se retiene para pagar la TDC.
 *
 * `tdcGap` = lo que falta (positivo) o sobra (negativo) para pagar la TDC con
 * lo retenido; con un plan cuadrado es 0.
 */
export function buildFortnightPlan(plan) {
  const settings = { ...DEFAULT_SETTINGS, ...plan.settings }
  const payer = plan.incomes.find((i) => i.covers?.includes('tdc'))
  if (!payer || !payer.payDays?.length) return null

  const totals = totalsByMedio(plan)
  const payDays = [...payer.payDays].sort((a, b) => a - b)
  const shares = splitAmount(payer.amount, payDays.length)

  const days = payDays.map((day, i) => {
    const income = shares[i]
    const transfers = []
    if (day === settings.spendTransferDay) {
      if (totals.tdc2 > 0) {
        transfers.push({ id: 'tdc2', medio: 'tdc2', purpose: 'fondear', amount: totals.tdc2 })
      }
      if (totals.debito > 0) {
        transfers.push({ id: 'debito', medio: 'debito', purpose: 'fondear', amount: totals.debito })
      }
      if (totals.efectivo > 0) {
        // El efectivo se manda primero al débito y de ahí se retira.
        transfers.push({
          id: 'efectivo',
          medio: 'efectivo',
          via: 'debito',
          purpose: 'retirar-efectivo',
          amount: totals.efectivo,
          parts: splitAmount(totals.efectivo, settings.cashWithdrawalParts),
        })
      }
    }
    return {
      day,
      income,
      transfers,
      retainedForTdc: fromCents(toCents(income) - toCents(sumLines(transfers))),
    }
  })

  const tdcFunded = sumLines(days.map((d) => ({ amount: d.retainedForTdc })))
  return {
    payerId: payer.id,
    spendTransferDayValid: payDays.includes(settings.spendTransferDay),
    days,
    tdcDue: totals.tdc,
    tdcFunded,
    tdcGap: fromCents(toCents(totals.tdc) - toCents(tdcFunded)),
  }
}

// -- Bolsillos --------------------------------------------------------------

// Cuánto se junta al año apartando `amount` cada mes.
export function annualContribution(line) {
  return fromCents(toCents(line.amount) * 12)
}

// Cuánto debe haber juntado el bolsillo cuando llegue su cobro (apartado
// mensual × meses entre cobros). El fondo general no tiene cobro propio → null.
export function targetPerPayment(line) {
  const months = PAY_FREQUENCY_MONTHS[line.payFrequency]
  if (!months || line.kind === 'fondo') return null
  return fromCents(toCents(line.amount) * months)
}
