import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useHousehold } from './HouseholdContext'
import { createEmptyPlan } from '../lib/budget'
import {
  isValidSettingValue,
  nextOrder,
  normalizeIncome,
  normalizeLine,
  normalizePlan,
} from '../lib/budgetPlan'
import {
  deleteIncome,
  deleteLine,
  newBudgetId,
  replacePlan,
  subscribeBudget,
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
        console.error('No se pudo leer el presupuesto:', err)
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
        if (isValidSettingValue(key, value) && Number(value) !== plan.settings[key]) clean[key] = Number(value)
      }
      if (Object.keys(clean).length > 0) run(writeSettings(householdId, uid, clean))
    },
    [householdId, uid, plan.settings, run]
  )

  const saveLine = useCallback(
    (input) => {
      if (!householdId) return
      const line = normalizeLine({
        ...input,
        id: input.id || newBudgetId(householdId, 'lines'),
        order: input.order ?? nextOrder(plan.lines),
      })
      if (line) run(writeLine(householdId, uid, line))
    },
    [householdId, uid, plan.lines, run]
  )

  const removeLine = useCallback(
    (lineId) => {
      if (householdId) run(deleteLine(householdId, uid, lineId))
    },
    [householdId, uid, run]
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
