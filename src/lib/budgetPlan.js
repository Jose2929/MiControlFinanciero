// ---------------------------------------------------------------------------
// Plan del presupuesto — normalización, validación y forma de guardado.
// Lógica pura (sin React ni Firebase), para probarla con Vitest.
//
// El plan vive en su propio nodo de Realtime Database
// (households/{hid}/budget), separado del perfil del hogar. Cada colección es
// un MAPA por id (no un arreglo) para poder escribir una sola línea sin tocar
// las demás. Tres rarezas de RTDB que esta capa absorbe al leer:
//   · los `null` y los arreglos vacíos NO se guardan → al leer faltan campos;
//   · un arreglo de primitivos puede volver como objeto {0: 15, 1: 30};
//   · los hijos de un mapa vuelven ordenados por clave, no por inserción →
//     el orden que ve el usuario se guarda en el campo `order` de cada línea.
// ---------------------------------------------------------------------------

import { DEFAULT_SETTINGS, MEDIO_ORDER, PAY_FREQUENCY_MONTHS, createEmptyPlan } from './budget'

export const PLAN_VERSION = 1

const FREQUENCIES = Object.keys(PAY_FREQUENCY_MONTHS)

const SETTING_RANGES = {
  cycleStartDay: [1, 31],
  cutDay: [1, 31],
  payDueDay: [1, 31],
  spendTransferDay: [1, 31],
  cashWithdrawalParts: [1, 6],
}

export const SETTING_LIMITS = SETTING_RANGES

const toNumber = (v) => (v == null || (typeof v === 'string' && v.trim() === '') ? NaN : Number(v))
const roundCents = (n) => Math.round(n * 100) / 100

// Las claves de RTDB no pueden llevar . # $ [ ] /
export function safeId(value) {
  return String(value).trim().replace(/[.#$[\]/]/g, '-')
}

export function isValidDay(value) {
  const n = toNumber(value)
  return Number.isInteger(n) && n >= 1 && n <= 31
}

// null si no hay día o no es válido.
function parseDay(value) {
  return isValidDay(value) ? Number(value) : null
}

export function isValidSettingValue(key, value) {
  const range = SETTING_RANGES[key]
  if (!range) return false
  const n = toNumber(value)
  return Number.isInteger(n) && n >= range[0] && n <= range[1]
}

// Arreglo o mapa de objetos → [clave, valor, posición]. Ignora lo que no sea objeto.
function entriesOf(value) {
  return rawEntriesOf(value).filter(([, v]) => v != null && typeof v === 'object')
}

function rawEntriesOf(value) {
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v, i])
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v], i) => [k, v, i])
  return []
}

// Arreglo o mapa de primitivos → arreglo.
function listOf(value) {
  if (Array.isArray(value)) return value.filter((v) => v != null)
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

// -- Líneas -----------------------------------------------------------------

// `kind` siempre se deduce: el usuario elige medio y (en TDC2) frecuencia de
// cobro; sin frecuencia, TDC2 es el fondo general.
export function lineKindFor(medio, payFrequency) {
  if (medio === 'tdc') return 'cargo'
  if (medio === 'tdc2') return payFrequency ? 'bolsillo' : 'fondo'
  if (medio === 'ahorro') return 'ahorro'
  return 'sobre'
}

export function compareLines(a, b) {
  return a.order - b.order || a.name.localeCompare(b.name, 'es')
}

export function nextOrder(lines) {
  return lines.reduce((max, l) => Math.max(max, Number(l.order) || 0), -1) + 1
}

/** Línea cruda (de RTDB, de un archivo o de un formulario) → línea limpia, o null si no tiene medio válido. */
export function normalizeLine(raw, fallbackId = '', fallbackOrder = 0) {
  if (!raw || typeof raw !== 'object' || !MEDIO_ORDER.includes(raw.medio)) return null
  const medio = raw.medio
  const payFrequency =
    medio === 'tdc2' ? (FREQUENCIES.includes(raw.payFrequency) ? raw.payFrequency : null) : 'mensual'
  const amount = toNumber(raw.amount)
  const order = toNumber(raw.order)
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  return {
    id: safeId(raw.id || fallbackId),
    medio,
    kind: lineKindFor(medio, payFrequency),
    name: name || 'Sin nombre',
    amount: Number.isFinite(amount) && amount >= 0 ? roundCents(amount) : 0,
    payDay: parseDay(raw.payDay),
    payFrequency,
    isValve: raw.isValve === true,
    order: Number.isFinite(order) ? order : fallbackOrder,
  }
}

// -- Ingresos ---------------------------------------------------------------

export function normalizeIncome(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null
  const amount = toNumber(raw.amount)
  const payDays = [...new Set(listOf(raw.payDays).map(parseDay).filter(Boolean))].sort((a, b) => a - b)
  const covers = new Set(listOf(raw.covers).filter((m) => MEDIO_ORDER.includes(m)))
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  return {
    id: safeId(raw.id || fallbackId),
    name: name || 'Ingreso',
    amount: Number.isFinite(amount) && amount >= 0 ? roundCents(amount) : 0,
    payDays,
    covers: MEDIO_ORDER.filter((m) => covers.has(m)),
  }
}

// -- Ajustes ----------------------------------------------------------------

export function normalizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(SETTING_RANGES)) {
    if (isValidSettingValue(key, raw?.[key])) out[key] = Number(raw[key])
  }
  return out
}

// -- Plan completo ----------------------------------------------------------

/** Nodo crudo (RTDB, archivo importado o null) → plan limpio. Nunca lanza. */
export function normalizePlan(raw) {
  const plan = createEmptyPlan()
  if (!raw || typeof raw !== 'object') return plan
  plan.settings = normalizeSettings(raw.settings)
  plan.incomes = entriesOf(raw.incomes)
    .map(([key, v]) => normalizeIncome(v, key))
    .filter(Boolean)
  plan.lines = entriesOf(raw.lines)
    .map(([key, v, i]) => normalizeLine(v, key, i))
    .filter(Boolean)
    .sort(compareLines)
  return plan
}

// -- Forma de guardado (árbol para RTDB) -----------------------------------

// Sin `undefined` (Firebase lo rechaza); los null se guardan como "borrar".
export function lineToTree(line) {
  return {
    id: line.id,
    medio: line.medio,
    kind: line.kind,
    name: line.name,
    amount: line.amount,
    payDay: line.payDay ?? null,
    payFrequency: line.payFrequency ?? null,
    isValve: Boolean(line.isValve),
    order: line.order ?? 0,
  }
}

export function incomeToTree(income) {
  return {
    id: income.id,
    name: income.name,
    amount: income.amount,
    payDays: [...income.payDays],
    covers: [...income.covers],
  }
}

export function planToTree(plan) {
  return {
    settings: { ...plan.settings },
    incomes: Object.fromEntries(plan.incomes.map((i) => [i.id, incomeToTree(i)])),
    lines: Object.fromEntries(plan.lines.map((l) => [l.id, lineToTree(l)])),
  }
}

// -- Respaldo en archivo ----------------------------------------------------

/** Plan → objeto legible para descargar (arreglos; el orden es la posición). */
export function planToExport(plan) {
  return {
    version: PLAN_VERSION,
    settings: { ...plan.settings },
    incomes: plan.incomes.map(incomeToTree),
    lines: [...plan.lines].sort(compareLines).map((line) => {
      // El orden queda implícito en la posición del arreglo.
      const { order, ...rest } = lineToTree(line) // eslint-disable-line no-unused-vars
      return rest
    }),
  }
}

const MAX_REPORTED_ERRORS = 8

function fail(errors) {
  const shown = errors.slice(0, MAX_REPORTED_ERRORS)
  if (errors.length > shown.length) shown.push(`…y ${errors.length - shown.length} problema(s) más.`)
  return { ok: false, errors: shown, plan: null }
}

/**
 * Valida un plan que viene de un archivo (string JSON u objeto). A diferencia
 * de normalizePlan —que perdona y rellena—, aquí se rechaza lo dudoso para no
 * importar un plan a medias sin avisar.
 *
 * @returns {{ ok: boolean, errors: string[], plan: object|null }}
 */
export function validatePlanInput(input) {
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return fail(['El archivo no es un JSON válido.'])
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return fail(['El archivo no tiene la forma de un plan (se esperaba un objeto).'])
  }
  if (data.lines == null && data.incomes == null) {
    return fail(['No parece un plan de presupuesto: faltan los ingresos y las líneas (incomes / lines).'])
  }

  const errors = []

  if (data.settings != null) {
    if (typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      errors.push('Los ajustes (settings) deben ser un objeto.')
    } else {
      for (const [key, [min, max]] of Object.entries(SETTING_RANGES)) {
        if (data.settings[key] != null && !isValidSettingValue(key, data.settings[key])) {
          errors.push(`Ajuste "${key}" inválido: debe ser un entero del ${min} al ${max}.`)
        }
      }
    }
  }

  const incomeIds = new Set()
  rawEntriesOf(data.incomes).forEach(([key, raw, i]) => {
    const label = `Ingreso ${i + 1}${raw && typeof raw.name === 'string' && raw.name ? ` ("${raw.name}")` : ''}`
    if (!raw || typeof raw !== 'object') {
      errors.push(`${label}: no es un objeto.`)
      return
    }
    if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push(`${label}: falta el nombre.`)
    const amount = toNumber(raw.amount)
    if (!Number.isFinite(amount) || amount < 0) errors.push(`${label}: monto inválido.`)
    const days = listOf(raw.payDays)
    if (days.length === 0) errors.push(`${label}: falta al menos un día de pago.`)
    else if (!days.every(isValidDay)) errors.push(`${label}: los días de pago deben ser enteros del 1 al 31.`)
    if (!listOf(raw.covers).every((m) => MEDIO_ORDER.includes(m))) {
      errors.push(`${label}: "covers" solo admite ${MEDIO_ORDER.join(', ')}.`)
    }
    const id = safeId(raw.id || key)
    if (incomeIds.has(id)) errors.push(`${label}: el id "${id}" está repetido.`)
    incomeIds.add(id)
  })

  const lineIds = new Set()
  rawEntriesOf(data.lines).forEach(([key, raw, i]) => {
    const label = `Línea ${i + 1}${raw && typeof raw.name === 'string' && raw.name ? ` ("${raw.name}")` : ''}`
    if (!raw || typeof raw !== 'object') {
      errors.push(`${label}: no es un objeto.`)
      return
    }
    if (!MEDIO_ORDER.includes(raw.medio)) errors.push(`${label}: medio inválido (usa ${MEDIO_ORDER.join(', ')}).`)
    if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push(`${label}: falta el nombre.`)
    const amount = toNumber(raw.amount)
    if (!Number.isFinite(amount) || amount < 0) errors.push(`${label}: monto inválido.`)
    if (raw.payDay != null && raw.payDay !== '' && !isValidDay(raw.payDay)) {
      errors.push(`${label}: el día debe ser un entero del 1 al 31.`)
    }
    if (raw.payFrequency != null && !FREQUENCIES.includes(raw.payFrequency)) {
      errors.push(`${label}: frecuencia inválida (usa ${FREQUENCIES.join(', ')}).`)
    }
    if (raw.medio === 'tdc2' && raw.kind === 'bolsillo' && !FREQUENCIES.includes(raw.payFrequency)) {
      errors.push(`${label}: un bolsillo necesita su frecuencia de cobro.`)
    }
    const id = safeId(raw.id || key)
    if (lineIds.has(id)) errors.push(`${label}: el id "${id}" está repetido.`)
    lineIds.add(id)
  })

  if (errors.length > 0) return fail(errors)
  return { ok: true, errors: [], plan: normalizePlan(data) }
}
