// ---------------------------------------------------------------------------
// Capa de (de)serialización del perfil — el puente entre el estado en memoria
// de FinanceContext y un objeto JSON plano que se puede guardar en cualquier
// backend (localStorage hoy, Firebase Realtime Database después).
//
// Diseño clave: el objeto serializado es un ÁRBOL NATIVO listo para RTDB.
//   · Las listas se guardan como MAPAS por id (no arrays) para evitar el bug
//     de RTDB que convierte arrays en objetos con índices numéricos y para
//     permitir actualizaciones parciales / reglas por ruta más adelante.
//   · Las fechas (Date) se guardan como ISO y se REVIVEN a Date al cargar,
//     porque el resto de la app hace aritmética de fechas (p.ej. b.date - a.date)
//     que se rompe con strings.
//   · Los iconos de categorías personalizadas son componentes React (no
//     serializables): se guarda solo el `iconId` string y se reconstruye con
//     getIconById al cargar.
//   · `readIds` (un Set) se guarda como array y se reconstruye como Set.
//   · El contador de ids locales se persiste para que los ids nuevos no
//     colisionen tras rehidratar.
// ---------------------------------------------------------------------------

import { getIconById, getIconId } from './categories'
import { periodKey } from './format'

export const SCHEMA_VERSION = 2

// -- Helpers ----------------------------------------------------------------

// Lista de objetos con `id` -> mapa { id: objeto }. Ignora entradas sin id.
function listToMap(list, keyFn = (item) => item.id) {
  const map = {}
  for (const item of list || []) {
    const key = keyFn(item)
    if (key == null) continue
    map[key] = item
  }
  return map
}

// Mapa -> array de valores. Firebase también puede devolver un array cuando
// las claves son numéricas y densas, así que toleramos ambos.
function mapToList(map) {
  if (!map) return []
  if (Array.isArray(map)) return map.filter(Boolean)
  return Object.values(map)
}

// Date | string | number -> ISO string (o null si no hay fecha válida).
function toISO(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ISO string | number | Date -> Date (o null).
function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// Convierte los campos Date de una transacción a ISO y viceversa.
function serializeTransaction(t) {
  return { ...t, date: toISO(t.date) }
}
function deserializeTransaction(t) {
  return { ...t, date: toDate(t.date) }
}

function serializeDebt(d) {
  return { ...d, cutDate: toISO(d.cutDate), dueDate: toISO(d.dueDate) }
}
function deserializeDebt(d) {
  return { ...d, cutDate: toDate(d.cutDate), dueDate: toDate(d.dueDate) }
}

// Categorías personalizadas: se descarta el componente `icon` y se guarda el
// `iconId` (usando el que ya trae el objeto o, como respaldo, resolviéndolo
// desde el componente).
function serializeCustomCategory(cat) {
  return {
    id: cat.id,
    label: cat.label,
    color: cat.color ?? null,
    iconId: cat.iconId || getIconId(cat.icon),
  }
}
function deserializeCustomCategory(cat) {
  return {
    id: cat.id,
    label: cat.label,
    color: cat.color ?? null,
    iconId: cat.iconId || 'Tag',
    colorVar: null,
    icon: getIconById(cat.iconId),
  }
}

// Confirmaciones de recurrentes: no tienen id propio -> clave sintética.
const confirmationKey = (c) => `${c.billId}__${c.period || periodKey(c.date)}`

// Confirmaciones de pago de deuda del mes — mismo patrón que las de
// recurrentes, evita poder registrar dos pagos del mismo período.
const debtConfirmationKey = (c) => `${c.debtId}__${c.period || periodKey(c.date)}`

// -- Serialización ----------------------------------------------------------

/**
 * Convierte el estado en memoria de FinanceContext en un objeto JSON plano,
 * listo para guardarse como árbol nativo en Firebase RTDB.
 *
 * @param {object} state slices del contexto + `idCounter` y `user` opcionales.
 * @returns {object} árbol serializable (sin Date, sin Set, sin componentes).
 */
export function serializeProfile(state) {
  const {
    accounts = [],
    transactions = [],
    debts = [],
    budgets = [],
    customCategories = [],
    incomeProfiles = [],
    recurringBills = [],
    recurringConfirmations = [],
    debtConfirmations = [],
    readIds = new Set(),
    idCounter = 1000,
    budgetTotalLimit = null,
    user = null,
    updatedAt = null,
  } = state

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: toISO(updatedAt) || toISO(new Date()),
      user: user || null,
    },
    idCounter,
    budgetTotalLimit,
    accounts: listToMap(accounts),
    transactions: listToMap(transactions.map(serializeTransaction)),
    debts: listToMap(debts.map(serializeDebt)),
    budgets: listToMap(budgets, (b) => b.categoryId),
    customCategories: listToMap(customCategories.map(serializeCustomCategory)),
    incomeProfiles: listToMap(incomeProfiles),
    recurringBills: listToMap(recurringBills),
    recurringConfirmations: listToMap(recurringConfirmations, confirmationKey),
    debtConfirmations: listToMap(debtConfirmations, debtConfirmationKey),
    readIds: Array.from(readIds),
  }
}

// -- Deserialización --------------------------------------------------------

/**
 * Reconstruye los slices de estado a partir de un objeto (o string JSON)
 * serializado. Tolera datos parciales/ausentes y revive Date, Set e iconos.
 *
 * @param {object|string} input árbol serializado o su string JSON.
 * @returns {object|null} slices listos para setear en FinanceContext, o null
 *   si el input está vacío / no es válido.
 */
export function deserializeProfile(input) {
  if (!input) return null
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return null
    }
  }
  if (typeof data !== 'object') return null

  const version = data.meta?.schemaVersion ?? 0
  const migrated = migrateProfile(data, version)

  const transactions = mapToList(migrated.transactions)
    .map(deserializeTransaction)
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))

  return {
    accounts: mapToList(migrated.accounts),
    transactions,
    debts: mapToList(migrated.debts).map(deserializeDebt),
    budgets: mapToList(migrated.budgets),
    customCategories: mapToList(migrated.customCategories).map(deserializeCustomCategory),
    incomeProfiles: mapToList(migrated.incomeProfiles),
    recurringBills: mapToList(migrated.recurringBills),
    recurringConfirmations: mapToList(migrated.recurringConfirmations).map((c) => ({
      ...c,
      date: toDate(c.date),
    })),
    debtConfirmations: mapToList(migrated.debtConfirmations).map((c) => ({
      ...c,
      date: toDate(c.date),
    })),
    readIds: new Set(Array.isArray(migrated.readIds) ? migrated.readIds : []),
    idCounter: Number(migrated.idCounter) || 1000,
    budgetTotalLimit: migrated.budgetTotalLimit != null ? Number(migrated.budgetTotalLimit) : null,
    user: migrated.meta?.user || null,
    updatedAt: toDate(migrated.meta?.updatedAt),
  }
}

// Hook de migración entre versiones de esquema — se encadenan
// transformaciones aquí (v0->v1, v1->v2, ...) sobre el árbol crudo, antes de
// deserializar. Idempotente: si el dato ya viene migrado, no hace nada.
function migrateProfile(data, fromVersion) {
  let out = data
  if (fromVersion < 1) {
    // v0 (sin meta) -> v1: el esquema es compatible, solo se normaliza meta.
    out = { ...out, meta: { ...(out.meta || {}), schemaVersion: 1 } }
  }
  if (fromVersion < 2) {
    // v1 tenía "Pago de deuda"/"Ahorro" como pseudo-categorías especiales
    // (GOAL_CATEGORIES en categories.js) cuyo "gastado" se calculaba aparte
    // de las transacciones reales (por tipo, no por categoryId) — un mismo
    // pago podía contar en dos líneas de presupuesto a la vez sin estar
    // realmente ligado a ambas. v2 las convierte en categorías normales de
    // verdad (mismo id, para no perder la línea de presupuesto ya
    // configurada), y liga a "Pago de deuda" cualquier deuda que no tuviera
    // ya su propia categoría, para no perder el agregado que ya tenía.
    out = migrateGoalCategoriesToReal(out)
  }
  return out
}

const GOAL_CATEGORY_DEFS = {
  'goal-debt-payment': { label: 'Pago de deuda', color: '#FB923C', iconId: 'HandCoins' },
  'goal-savings': { label: 'Ahorro', color: '#2DD4BF', iconId: 'PiggyBank' },
}

function migrateGoalCategoriesToReal(data) {
  const budgets = data.budgets || {}
  const customCategories = { ...(data.customCategories || {}) }
  const debts = { ...(data.debts || {}) }
  let changed = false

  for (const [goalId, def] of Object.entries(GOAL_CATEGORY_DEFS)) {
    if (budgets[goalId] && !customCategories[goalId]) {
      customCategories[goalId] = { id: goalId, ...def }
      changed = true
    }
  }

  if (customCategories['goal-debt-payment']) {
    for (const id of Object.keys(debts)) {
      if (!debts[id].categoryId) {
        debts[id] = { ...debts[id], categoryId: 'goal-debt-payment' }
        changed = true
      }
    }
  }

  if (!changed) return data
  return { ...data, customCategories, debts }
}
