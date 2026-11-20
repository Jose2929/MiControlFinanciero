import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useHousehold } from './HouseholdContext'
import { MEDIO_ORDER, createEmptyPlan, getCycleForDate } from '../lib/budget'
import {
  coerceSettingValue,
  isValidCheckKey,
  isValidCycleKey,
  nextOrder,
  normalizeAdjustment,
  normalizeIncome,
  normalizeLine,
  normalizePlan,
} from '../lib/budgetPlan'
import {
  deleteAdjustment,
  deleteIncome,
  deleteLine,
  newBudgetId,
  replacePlan,
  subscribeBudget,
  writeAccountMedios,
  writeAdjustment,
  writeCategoryEnvelope,
  writeCheck,
  writeIncome,
  writeLine,
  writeSettings,
} from '../lib/budgetStore'

// Se exporta el contexto (no solo el hook) para poder probar las pantallas con
// un valor armado a mano, sin Firebase.
export const BudgetContext = createContext(null)

const INITIAL = { status: 'loading', plan: createEmptyPlan(), exists: false }

function friendlyWriteError(err) {
  if (err?.code === 'PERMISSION_DENIED') {
    return 'Firebase rechazó el cambio: falta publicar la regla del presupuesto en la consola.'
  }
  return 'No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.'
}

/**
 * Plan del presupuesto del hogar, en vivo desde households/{hid}/budget.
 *
 * Las escrituras son optimistas: Firebase actualiza la copia local al
 * instante y confirma después, así que las funciones de abajo NO esperan al
 * servidor (sin conexión, esperar dejaría un modal colgado). Si el servidor
 * rechaza el cambio, queda en `writeError` y la pantalla lo muestra.
 *
 * A diferencia del perfil, un PERMISSION_DENIED aquí no cierra la sesión: lo
 * normal es que simplemente falte publicar la regla del nodo `budget`.
 */
export function BudgetProvider({ children }) {
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const uid = user?.uid || null

  const [state, setState] = useState(INITIAL)
  const [writeError, setWriteError] = useState(null)

  useEffect(() => {
    if (!householdId) return undefined
    setState(INITIAL)
    return subscribeBudget(
      householdId,
      (raw) => setState({ status: 'ready', exists: raw != null, plan: normalizePlan(raw) }),
      (err) => {
        // Mientras no se publique la regla del nodo, esto es lo esperado: se
        // avisa en la pantalla Plan, no con un error en la consola de todas.
        if (err?.code === 'PERMISSION_DENIED') console.warn('Presupuesto: Firebase aún no permite leer el nodo budget.')
        else console.error('No se pudo leer el presupuesto:', err)
        setState({
          status: err?.code === 'PERMISSION_DENIED' ? 'denied' : 'error',
          plan: createEmptyPlan(),
          exists: false,
        })
      }
    )
  }, [householdId])

  const { plan } = state

  const run = useCallback((promise) => {
    promise.catch((err) => {
      console.error('No se pudo guardar el presupuesto:', err)
      setWriteError(friendlyWriteError(err))
    })
  }, [])

  const updateSettings = useCallback(
    (patch) => {
      if (!householdId) return
      // Solo valores válidos y que de verdad cambian.
      const clean = {}
      for (const [key, value] of Object.entries(patch)) {
        const coerced = coerceSettingValue(key, value)
        if (coerced !== undefined && coerced !== plan.settings[key]) clean[key] = coerced
      }
      if (Object.keys(clean).length > 0) run(writeSettings(householdId, uid, clean))
    },
    [householdId, uid, plan.settings, run]
  )

  // Palomita del calendario: `monthKey` 'AAAA-MM', `eventKey` la clave del evento.
  const setCheck = useCallback(
    (monthKey, eventKey, checked) => {
      if (!householdId || !isValidCycleKey(monthKey) || !isValidCheckKey(eventKey)) return
      run(writeCheck(householdId, uid, monthKey, eventKey, Boolean(checked)))
    },
    [householdId, uid, run]
  )

  const saveLine = useCallback(
    (input) => {
      if (!householdId) return
      const isNew = !input.id
      const line = normalizeLine({
        ...input,
        id: input.id || newBudgetId(householdId, 'lines'),
        order: input.order ?? nextOrder(plan.lines),
        // Una línea nueva acumula desde el ciclo de hoy, no "hacia atrás".
        since: isNew ? getCycleForDate(new Date(), plan.settings.cycleStartDay).key : input.since,
      })
      if (line) run(writeLine(householdId, uid, line))
    },
    [householdId, uid, plan.lines, run]
  )

  const removeLine = useCallback(
    (lineId) => {
      if (!householdId) return
      // Las ligas categoría → sobre que apuntaban a este renglón se quitan con él.
      const links = []
      for (const [medio, byCategory] of Object.entries(plan.categoryEnvelopes)) {
        for (const [categoryId, id] of Object.entries(byCategory)) {
          if (id === lineId) links.push({ medio, categoryId })
        }
      }
      run(deleteLine(householdId, uid, lineId, links))
    },
    [householdId, uid, plan.categoryEnvelopes, run]
  )

  const saveIncome = useCallback(
    (input) => {
      if (!householdId) return
      const income = normalizeIncome({ ...input, id: input.id || newBudgetId(householdId, 'incomes') })
      if (income) run(writeIncome(householdId, uid, income))
    },
    [householdId, uid, run]
  )

  const removeIncome = useCallback(
    (incomeId) => {
      if (householdId) run(deleteIncome(householdId, uid, incomeId))
    },
    [householdId, uid, run]
  )

  // patch: { [accountId]: medio | null }
  const setAccountMedios = useCallback(
    (patch) => {
      if (!householdId) return
      const clean = {}
      for (const [accountId, medio] of Object.entries(patch)) {
        if (medio === null || MEDIO_ORDER.includes(medio)) clean[accountId] = medio
      }
      if (Object.keys(clean).length > 0) run(writeAccountMedios(householdId, uid, clean))
    },
    [householdId, uid, run]
  )

  // lineId null = quitar la liga.
  const setCategoryEnvelope = useCallback(
    (medio, categoryId, lineId) => {
      if (!householdId || !MEDIO_ORDER.includes(medio) || !categoryId) return
      run(writeCategoryEnvelope(householdId, uid, medio, categoryId, lineId || null))
    },
    [householdId, uid, run]
  )

  // { envelopeId, amount (con signo), date 'AAAA-MM-DD', note }
  const addAdjustment = useCallback(
    (input) => {
      if (!householdId) return
      const adjustment = normalizeAdjustment(
        { ...input, id: newBudgetId(householdId, 'adjustments'), createdBy: uid },
        ''
      )
      if (adjustment) run(writeAdjustment(householdId, uid, adjustment))
    },
    [householdId, uid, run]
  )

  const removeAdjustment = useCallback(
    (adjustmentId) => {
      if (householdId) run(deleteAdjustment(householdId, uid, adjustmentId))
    },
    [householdId, uid, run]
  )

  const importPlan = useCallback(
    (nextPlan) => {
      if (householdId) run(replacePlan(householdId, uid, nextPlan))
    },
    [householdId, uid, run]
  )

  const clearWriteError = useCallback(() => setWriteError(null), [])

  const value = useMemo(
    () => ({
      status: state.status,
      plan,
      hasPlan: state.exists && (plan.lines.length > 0 || plan.incomes.length > 0),
      writeError,
      clearWriteError,
      updateSettings,
      saveLine,
      removeLine,
      saveIncome,
      removeIncome,
      setAccountMedios,
      setCategoryEnvelope,
      addAdjustment,
      removeAdjustment,
      setCheck,
      importPlan,
    }),
    [
      state.status,
      state.exists,
      plan,
      writeError,
      clearWriteError,
      updateSettings,
      saveLine,
      removeLine,
      saveIncome,
      removeIncome,
      setAccountMedios,
      setCategoryEnvelope,
      addAdjustment,
      removeAdjustment,
      setCheck,
      importPlan,
    ]
  )

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudget() {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget debe usarse dentro de BudgetProvider')
  return ctx
}
