// ---------------------------------------------------------------------------
// Lectura y escritura del plan del presupuesto en Realtime Database.
//
// Vive en households/{hid}/budget — un nodo APARTE del perfil del hogar
// (households/{hid}/profile). Razón: el perfil se guarda completo con set(),
// así que una versión vieja de la app abierta en un celular borraría cualquier
// clave que no conozca. Este nodo solo se toca con update() de rutas puntuales
// (una línea, un ajuste), nunca con un set() del árbol entero.
//
//   budget/
//     meta/      { version, updatedAt, updatedBy }
//     settings/  { cycleStartDay, cutDay, ... }
//     incomes/   { [id]: {...} }
//     lines/     { [id]: {...} }
//
// Requiere la regla "budget" de database.rules.json publicada en la consola de
// Firebase (ver ese archivo).
// ---------------------------------------------------------------------------

import { ref, onValue, update, push } from 'firebase/database'
import { db } from './firebase'
import { PLAN_VERSION, incomeToTree, lineToTree, planToTree } from './budgetPlan'

const basePath = (householdId) => `households/${householdId}/budget`

/** Escucha el nodo completo. Devuelve la función para cancelar. */
export function subscribeBudget(householdId, onChange, onError) {
  return onValue(
    ref(db, basePath(householdId)),
    (snapshot) => onChange(snapshot.exists() ? snapshot.val() : null),
    onError
  )
}

/** Id nuevo para una línea o ingreso (push de Firebase: no choca entre celulares). */
export function newBudgetId(householdId, collection) {
  return push(ref(db, `${basePath(householdId)}/${collection}`)).key
}

// Marca quién y cuándo tocó el plan por última vez (rutas hermanas, sin traslape).
function stamp(householdId, uid) {
  const base = basePath(householdId)
  return {
    [`${base}/meta/version`]: PLAN_VERSION,
    [`${base}/meta/updatedAt`]: new Date().toISOString(),
    [`${base}/meta/updatedBy`]: uid || null,
  }
}

const commit = (updates) => update(ref(db), updates)

/** `patch` solo con las claves que cambian — no pisa ajustes que otro celular editó. */
export function writeSettings(householdId, uid, patch) {
  const base = basePath(householdId)
  const updates = stamp(householdId, uid)
  for (const [key, value] of Object.entries(patch)) updates[`${base}/settings/${key}`] = value
  return commit(updates)
}

export function writeLine(householdId, uid, line) {
  return commit({ ...stamp(householdId, uid), [`${basePath(householdId)}/lines/${line.id}`]: lineToTree(line) })
}

export function deleteLine(householdId, uid, lineId) {
  return commit({ ...stamp(householdId, uid), [`${basePath(householdId)}/lines/${lineId}`]: null })
}

export function writeIncome(householdId, uid, income) {
  return commit({
    ...stamp(householdId, uid),
    [`${basePath(householdId)}/incomes/${income.id}`]: incomeToTree(income),
  })
}

export function deleteIncome(householdId, uid, incomeId) {
  return commit({ ...stamp(householdId, uid), [`${basePath(householdId)}/incomes/${incomeId}`]: null })
}

/** `patch`: { [accountId]: medio | null } — null desliga la cuenta del presupuesto. */
export function writeAccountMedios(householdId, uid, patch) {
  const base = basePath(householdId)
  const updates = stamp(householdId, uid)
  for (const [accountId, medio] of Object.entries(patch)) updates[`${base}/accountMedios/${accountId}`] = medio
  return commit(updates)
}

/**
 * Reemplaza ajustes, ingresos y líneas de una sola vez (importar un plan).
 * No toca otros hijos del nodo (p. ej. las casillas de la quincena).
 */
export function replacePlan(householdId, uid, plan) {
  const base = basePath(householdId)
  const tree = planToTree(plan)
  return commit({
    ...stamp(householdId, uid),
    [`${base}/settings`]: tree.settings,
    [`${base}/incomes`]: tree.incomes,
    [`${base}/lines`]: tree.lines,
  })
}
