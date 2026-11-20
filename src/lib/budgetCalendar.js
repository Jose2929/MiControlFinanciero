// ---------------------------------------------------------------------------
// Calendario del presupuesto — lógica pura (sin React ni Firebase).
//
// A partir del plan arma qué pasa cada día de un mes: sueldos, transferencias
// del reparto, cargos a la TDC, corte y pago de la TDC, gastos y ahorros
// programados. Cada evento lleva una `key` estable (la misma en todos los
// meses) para que su palomita de "ya lo hice" se guarde por mes.
//
// Reglas:
//   · Un día que no existe en el mes (30 en febrero) cae en el último día del mes.
//   · Solo se programan los renglones con día de pago y frecuencia mensual. Los
//     bolsillos (anual/semestral) no tienen fecha de cobro en el plan, así que no
//     salen aquí; un cargo no mensual tampoco (no sabemos en qué mes cae).
//   · Fechas siempre locales; montos en pesos (la suma en centavos la hace budget.js).
// ---------------------------------------------------------------------------

import {
  DEFAULT_SETTINGS,
  MEDIO_LABELS,
  buildFortnightPlan,
  clampedDate,
  splitAmount,
  totalsByMedio,
} from './budget'
import { formatMoney } from './format'

// Orden en que se listan los tipos de evento dentro de un día.
export const EVENT_KINDS = ['ingreso', 'transferencia', 'pago', 'cargo', 'gasto', 'ahorro', 'corte']

const KIND_RANK = Object.fromEntries(EVENT_KINDS.map((kind, i) => [kind, i]))

const money = (n) => formatMoney(n, { cents: !Number.isInteger(n) })

const safeKey = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, '_')

/** (2026, 11) → '2026-12' (el mes va de 0 a 11, como en Date). */
export function monthKey(year, month) {
  const d = new Date(year, month, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthName = (year, month) => new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(year, month, 1))

/** Días que tiene el mes. */
export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

/**
 * Eventos de un mes.
 *
 * @returns {{
 *   events: Array<{ key, kind, day, title, subtitle, amount, checkable, isValve }>,
 *   byDay: Record<number, Array>,
 *   totals: { ingreso: number, pago: number, ahorro: number, cargos: number },
 * }}
 */
export function buildMonthEvents(plan, year, month) {
  const settings = { ...DEFAULT_SETTINGS, ...plan.settings }
  const events = []

  const push = (event) =>
    events.push({
      subtitle: '',
      amount: null,
      checkable: true,
      isValve: false,
      ...event,
      day: clampedDate(year, month, event.nominalDay).getDate(),
    })

  // Sueldos: el monto se reparte en partes iguales entre sus días de pago.
  for (const income of plan.incomes) {
    const days = [...new Set(income.payDays || [])].sort((a, b) => a - b)
    if (days.length === 0) continue
    const shares = splitAmount(income.amount, days.length)
    days.forEach((day, i) =>
      push({
        key: `ing_${safeKey(income.id)}_${day}`,
        kind: 'ingreso',
        nominalDay: day,
        title: `Sueldo de ${income.name}`,
        subtitle: days.length > 1 ? `Pago ${i + 1} de ${days.length}` : '',
        amount: shares[i],
      })
    )
  }

  // Reparto del sueldo que cubre la TDC: qué se pasa a cada cuenta y qué se deja para la tarjeta.
  const fortnight = buildFortnightPlan(plan)
  for (const entry of fortnight?.days || []) {
    for (const transfer of entry.transfers) {
      const base = { key: `trf_${entry.day}_${safeKey(transfer.id)}`, kind: 'transferencia', nominalDay: entry.day, amount: transfer.amount }
      if (transfer.medio === 'tdc2') {
        push({ ...base, title: 'Pasar a TDC2', subtitle: 'Para los bolsillos y el fondo' })
      } else if (transfer.medio === 'debito') {
        push({ ...base, title: 'Pasar al Débito', subtitle: 'Para el gasto diario' })
      } else {
        const parts = transfer.parts || []
        push({
          ...base,
          title: 'Pasar al Débito para el efectivo',
          subtitle:
            parts.length > 1
              ? `Se retira en ${parts.length} partes: ${parts.map(money).join(' + ')}`
              : 'Se retira de la cuenta de débito',
        })
      }
    }
    if (entry.retainedForTdc > 0) {
      push({
        key: `trf_${entry.day}_tdc`,
        kind: 'transferencia',
        nominalDay: entry.day,
        title: 'Dejar para la TDC',
        subtitle: 'Se junta para el pago de la tarjeta',
        amount: entry.retainedForTdc,
      })
    }
  }

  // Renglones con día de pago.
  for (const line of plan.lines) {
    if (line.payDay == null) continue
    if (line.payFrequency && line.payFrequency !== 'mensual') continue
    const common = { key: `${line.kind}_${safeKey(line.id)}`, nominalDay: line.payDay, title: line.name, amount: line.amount }
    if (line.kind === 'cargo') {
      push({ ...common, kind: 'cargo', subtitle: line.isValve ? 'Cargo a la TDC · válvula del plan' : 'Cargo a la TDC', isValve: line.isValve })
    } else if (line.kind === 'ahorro') {
      push({ ...common, kind: 'ahorro', subtitle: 'Ahorro programado' })
    } else if (line.kind === 'sobre' || line.kind === 'fondo') {
      push({ ...common, kind: 'gasto', subtitle: `Gasto programado · ${MEDIO_LABELS[line.medio] || ''}`.replace(/ · $/, '') })
    }
  }

  // Corte y pago de la TDC. Si el límite es menor o igual que el corte, es del mes siguiente.
  if (plan.lines.some((line) => line.medio === 'tdc')) {
    const { cutDay, payDueDay } = settings
    const cutMonth = payDueDay <= cutDay ? month - 1 : month
    const tdcTotal = totalsByMedio(plan).tdc
    push({
      key: 'corte_tdc',
      kind: 'corte',
      nominalDay: cutDay,
      title: 'Corte de la TDC',
      subtitle: 'Cierra el estado de cuenta',
      checkable: false,
    })
    push({
      key: 'pago_tdc',
      kind: 'pago',
      nominalDay: payDueDay,
      title: 'Pago de la TDC',
      subtitle: `Estado con corte del ${cutDay} de ${monthName(year, cutMonth)}`,
      amount: tdcTotal > 0 ? tdcTotal : null,
    })
  }

  events.sort(
    (a, b) => a.day - b.day || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.title.localeCompare(b.title, 'es')
  )

  const byDay = {}
  for (const event of events) (byDay[event.day] ||= []).push(event)

  const sumOf = (kind) =>
    Math.round(events.filter((e) => e.kind === kind).reduce((sum, e) => sum + Math.round((e.amount || 0) * 100), 0)) / 100

  return {
    events,
    byDay,
    totals: { ingreso: sumOf('ingreso'), pago: sumOf('pago'), ahorro: sumOf('ahorro'), cargos: sumOf('cargo') },
  }
}

/**
 * Cuántas palomitas hay encendidas entre las que se pueden marcar.
 * `checks` es el mapa de ese mes: { [clave]: true }.
 */
export function countChecks(events, checks = {}) {
  const checkable = events.filter((e) => e.checkable)
  return { done: checkable.filter((e) => checks[e.key] === true).length, total: checkable.length }
}

/** Cómo va un día: 'none' (sin nada que marcar), 'pending', 'partial' o 'done'. */
export function dayStatus(events, checks = {}) {
  const { done, total } = countChecks(events, checks)
  if (total === 0) return 'none'
  if (done === 0) return 'pending'
  return done === total ? 'done' : 'partial'
}

/** Tipos distintos que hay en un día, con cuántos eventos y si todos están hechos. */
export function kindsOfDay(events, checks = {}) {
  return EVENT_KINDS.map((kind) => {
    const ofKind = events.filter((e) => e.kind === kind)
    if (ofKind.length === 0) return null
    const checkable = ofKind.filter((e) => e.checkable)
    return {
      kind,
      count: ofKind.length,
      done: checkable.length > 0 && checkable.every((e) => checks[e.key] === true),
    }
  }).filter(Boolean)
}
