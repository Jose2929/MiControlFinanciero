import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ref, get, set, onValue } from 'firebase/database'
import { STATIC_NOTIFICATIONS } from '../data/mockData'
import { CATEGORIES, getCategory, getIconById } from '../lib/categories'
import { serializeProfile, deserializeProfile } from '../lib/profileSchema'
import { createFirebaseRealtimeStore } from '../lib/profileStore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import { useHousehold } from './HouseholdContext'
import {
  isInMonth,
  monthStart,
  formatMonthLabel,
  getDueUrgency,
  getBudgetStatus,
  formatMoney,
  formatPercent,
  formatRelativeDue,
  addMonths,
  periodKey,
  parseDateInputValue,
} from '../lib/format'

const FinanceContext = createContext(null)

// Tiempo de inactividad antes de guardar solo, tras la última edición.
const AUTOSAVE_DELAY_MS = 1500

let localIdCounter = 1000
const nextLocalId = (prefix) => `${prefix}-${(localIdCounter += 1)}`
const getIdCounter = () => localIdCounter
// Al rehidratar un perfil guardado subimos el contador por encima del último
// id usado para que los ids nuevos no colisionen con los restaurados.
const bumpIdCounter = (n) => {
  if (Number.isFinite(n) && n > localIdCounter) localIdCounter = n
}

// Ajusta el saldo de una cuenta por un gasto — sign +1 aplica un gasto nuevo,
// -1 lo revierte (usado al editar/eliminar una transacción existente).
// counterAccountId es opcional: si el gasto "paga" una tarjeta de crédito
// (ese gasto se origina de otra cuenta pero también salda esa tarjeta), la
// cuenta contraparte baja su `used` — lo contrario de cargarle un gasto.
function applyExpenseEffect(accounts, accountId, amount, sign, counterAccountId) {
  return accounts.map((acc) => {
    if (acc.id === accountId) {
      if (acc.type === 'credito') return { ...acc, used: Math.max(acc.used + sign * amount, 0) }
      return { ...acc, balance: acc.balance - sign * amount }
    }
    if (counterAccountId && acc.id === counterAccountId && acc.type === 'credito') {
      return { ...acc, used: Math.max(acc.used - sign * amount, 0) }
    }
    return acc
  })
}

// Detecta errores de permisos/auth (token inválido o expirado, o ya no
// perteneces al hogar) para forzar cierre de sesión en vez de solo reintentar
// — el código estándar de Firebase RTDB para una regla de seguridad denegada.
function isAuthLikeError(err) {
  return err?.code === 'PERMISSION_DENIED'
}

// Igual que applyExpenseEffect pero para pagos de deuda — polaridad opuesta
// en tarjetas de crédito (un pago BAJA el saldo usado, no lo sube).
function applyDebtPaymentEffect(accounts, accountId, amount, sign) {
  return accounts.map((acc) => {
    if (acc.id !== accountId) return acc
    if (acc.type === 'credito') return { ...acc, used: Math.max(acc.used - sign * amount, 0) }
    return { ...acc, balance: acc.balance - sign * amount }
  })
}

export function FinanceProvider({ children, store: providedStore }) {
  const { user: authUser, signOut: authSignOut } = useAuth()
  const { householdId } = useHousehold()

  // Un hogar real siempre arranca limpio (sin el dataset de ejemplo).
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [debts, setDebts] = useState([])
  const [budgets, setBudgets] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [readIds, setReadIds] = useState(() => new Set())
  const [incomeProfiles, setIncomeProfiles] = useState([])
  const [recurringBills, setRecurringBills] = useState([])
  const [recurringConfirmations, setRecurringConfirmations] = useState([])
  const [debtConfirmations, setDebtConfirmations] = useState([])
  const [budgetTotalLimit, setBudgetTotalLimitState] = useState(null)

  // -- Persistencia (Firebase RTDB, guardado manual + lectura en vivo) ----
  // El adaptador apunta a households/{householdId}/profile — el nodo
  // compartido del hogar (ver src/lib/household.js). Se puede inyectar un
  // adaptador distinto (p.ej. en pruebas) vía la prop `store`.
  const store = useMemo(() => {
    if (providedStore) return providedStore
    if (!householdId) return null
    return createFirebaseRealtimeStore({ db, ref, get, set, onValue, id: householdId })
  }, [providedStore, householdId])

  const [hydrated, setHydrated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error | conflict
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [remoteAhead, setRemoteAhead] = useState(false)

  // Refs de coordinación entre el listener remoto y el guardado local:
  const dirtyRef = useRef(false) // espejo de `dirty`, legible dentro del callback de subscribe
  const remoteApplyRef = useRef(false) // true mientras aplicamos datos remotos (no cuenta como edición del usuario)
  const dirtyGuard = useRef(false) // salta el primer "cambio" justo después de hidratar
  const pendingRemoteRef = useRef(null) // snapshot remoto más nuevo que no se aplicó por haber ediciones locales

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Reemplaza todos los slices del estado con los de un perfil deserializado.
  // `remote: true` indica que viene del listener de Firebase (no cuenta como
  // edición del usuario para el tracking de "cambios sin guardar").
  const applyProfile = useCallback((data, { remote = false } = {}) => {
    if (!data) return
    if (remote) remoteApplyRef.current = true
    setAccounts(data.accounts)
    setTransactions(data.transactions)
    setDebts(data.debts)
    setBudgets(data.budgets)
    setCustomCategories(data.customCategories)
    setIncomeProfiles(data.incomeProfiles)
    setRecurringBills(data.recurringBills)
    setRecurringConfirmations(data.recurringConfirmations)
    setDebtConfirmations(data.debtConfirmations)
    setReadIds(data.readIds)
    setBudgetTotalLimitState(data.budgetTotalLimit)
    bumpIdCounter(data.idCounter)
  }, [])

  // Snapshot del estado actual como árbol serializable (para guardar/exportar).
  const buildSnapshot = useCallback(
    () =>
      serializeProfile({
        accounts,
        transactions,
        debts,
        budgets,
        customCategories,
        incomeProfiles,
        recurringBills,
        recurringConfirmations,
        debtConfirmations,
        readIds,
        idCounter: getIdCounter(),
        budgetTotalLimit,
        user: authUser,
        updatedAt: new Date(),
      }),
    [
      accounts,
      transactions,
      debts,
      budgets,
      customCategories,
      incomeProfiles,
      recurringBills,
      recurringConfirmations,
      debtConfirmations,
      readIds,
      budgetTotalLimit,
      authUser,
    ]
  )

  // Lectura en vivo: cada cambio que guarda cualquier miembro del hogar llega
  // aquí. Si no hay ediciones locales sin guardar, se aplica directo. Si las
  // hay, no se sobreescribe — se marca `remoteAhead` para avisar en la UI.
  useEffect(() => {
    if (!store) return

    // Nuevo store (alta inicial o cambio de hogar): las ediciones locales
    // previas ya no aplican a este árbol, así que se descartan para no
    // bloquear la sincronización con un "conflicto" que no es tal.
    dirtyGuard.current = false
    pendingRemoteRef.current = null
    setDirty(false)
    setRemoteAhead(false)
    setSaveState('idle')

    // Limpia también los datos en memoria del hogar anterior. Sin esto, si el
    // hogar nuevo todavía no tiene perfil guardado (raw === null más abajo),
    // la app se queda mostrando —y puede terminar autoguardando— los datos
    // del hogar anterior bajo la identidad del nuevo (fuga entre hogares).
    setHydrated(false)
    remoteApplyRef.current = true
    setAccounts([])
    setTransactions([])
    setDebts([])
    setBudgets([])
    setCustomCategories([])
    setIncomeProfiles([])
    setRecurringBills([])
    setRecurringConfirmations([])
    setDebtConfirmations([])
    setReadIds(new Set())
    setBudgetTotalLimitState(null)

    const unsubscribe = store.subscribe(
      (raw) => {
        const data = raw ? deserializeProfile(raw) : null
        if (data) {
          if (!dirtyRef.current) {
            applyProfile(data, { remote: true })
            pendingRemoteRef.current = null
            setRemoteAhead(false)
            setLastSavedAt(data.updatedAt || null)
          } else {
            pendingRemoteRef.current = data
            setRemoteAhead(true)
          }
        }
        setHydrated(true)
      },
      (err) => {
        console.error('No se pudo leer el perfil del hogar:', err)
        if (isAuthLikeError(err)) {
          authSignOut('Tu sesión expiró o perdiste acceso a este hogar. Vuelve a iniciar sesión.')
        } else {
          setSaveState('error')
        }
      }
    )
    return unsubscribe
  }, [store, applyProfile, authSignOut])

  // Marca "cambios sin guardar" cuando cambia cualquier slice serializable.
  // Se ignoran: el primer render posterior a la hidratación (dirtyGuard) y
  // los cambios que vinieron de aplicar un snapshot remoto (remoteApplyRef).
  useEffect(() => {
    if (!hydrated) return
    if (remoteApplyRef.current) {
      remoteApplyRef.current = false
      // Cualquier render de hidratación (con datos remotos o vacío) cuenta
      // como "el primer render" — si no se marca aquí también, la PRÓXIMA
      // edición real (la primera del usuario) cae en la guarda de abajo y se
      // descarta en silencio, y solo la segunda edición queda marcada dirty.
      dirtyGuard.current = true
      return
    }
    if (!dirtyGuard.current) {
      dirtyGuard.current = true
      return
    }
    setDirty(true)
    setSaveState('idle')
  }, [
    hydrated,
    accounts,
    transactions,
    debts,
    budgets,
    customCategories,
    incomeProfiles,
    recurringBills,
    recurringConfirmations,
    debtConfirmations,
    budgetTotalLimit,
    readIds,
  ])

  // Guardado manual: persiste el snapshot completo vía el adaptador. Si un
  // compañero de hogar guardó algo más reciente que no hemos absorbido, no
  // sobreescribe solo — pasa a `saveState: 'conflict'` para que la UI
  // ofrezca "recargar" o "sobrescribir" (force: true).
  const saveProfile = useCallback(
    async ({ force = false } = {}) => {
      if (!store) throw new Error('Aún no hay un hogar listo para guardar.')
      if (!force && pendingRemoteRef.current) {
        setSaveState('conflict')
        return null
      }
      setSaveState('saving')
      try {
        const snapshot = buildSnapshot()
        await store.save(snapshot)
        pendingRemoteRef.current = null
        setRemoteAhead(false)
        setDirty(false)
        setLastSavedAt(new Date())
        setSaveState('saved')
        return snapshot
      } catch (err) {
        console.error('No se pudo guardar el perfil:', err)
        if (isAuthLikeError(err)) {
          authSignOut('Tu sesión expiró o perdiste acceso a este hogar. Vuelve a iniciar sesión.')
        }
        setSaveState('error')
        throw err
      }
    },
    [buildSnapshot, store, authSignOut]
  )

  // Guardado automático: cada edición nueva reinicia un pequeño debounce; al
  // dejar de haber cambios por AUTOSAVE_DELAY_MS, se guarda solo. Si cae en
  // conflicto, saveProfile() ya lo maneja (no sobreescribe solo) — aquí no
  // hace falta lógica extra, solo no reintentar en loop.
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      saveProfile().catch(() => {})
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [
    dirty,
    accounts,
    transactions,
    debts,
    budgets,
    customCategories,
    incomeProfiles,
    recurringBills,
    recurringConfirmations,
    debtConfirmations,
    budgetTotalLimit,
    readIds,
    saveProfile,
  ])

  // Descarta las ediciones locales sin guardar y aplica el snapshot remoto
  // pendiente — la otra mitad del diálogo de conflicto.
  const discardLocalAndSyncRemote = useCallback(() => {
    if (!pendingRemoteRef.current) return
    applyProfile(pendingRemoteRef.current, { remote: true })
    setLastSavedAt(pendingRemoteRef.current.updatedAt || null)
    pendingRemoteRef.current = null
    setRemoteAhead(false)
    setDirty(false)
    setSaveState('idle')
  }, [applyProfile])

  // Genera el JSON completo del perfil (string legible) para exportar/descargar.
  const exportProfile = useCallback(() => JSON.stringify(buildSnapshot(), null, 2), [buildSnapshot])

  // Recibe un JSON (objeto o string) y rehidrata todo el estado con él —
  // cuenta como edición local: hay que presionar Guardar para persistirlo.
  const importProfile = useCallback(
    (input) => {
      const data = deserializeProfile(input)
      if (!data) throw new Error('El JSON del perfil no es válido')
      applyProfile(data)
      return data
    },
    [applyProfile]
  )

  const allCategories = useMemo(() => [...CATEGORIES, ...customCategories], [customCategories])

  const findCategory = useCallback(
    (id) => allCategories.find((c) => c.id === id) || getCategory(id),
    [allCategories]
  )

  const findIncomeProfile = useCallback(
    (id) => incomeProfiles.find((p) => p.id === id) || { id, label: 'Ingreso', mode: 'fixed' },
    [incomeProfiles]
  )

  // -- Monthly aggregates -----------------------------------------------
  const monthTransactions = useMemo(
    () => transactions.filter((t) => isInMonth(t.date, 0)),
    [transactions]
  )
  const prevMonthTransactions = useMemo(
    () => transactions.filter((t) => isInMonth(t.date, 1)),
    [transactions]
  )

  const sumBy = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)

  const monthIncome = useMemo(() => sumBy(monthTransactions, 'income'), [monthTransactions])

  // Un gasto cuenta como pago de deuda para este desglose (no como "gasto"),
  // sin importar si se creó como gasto normal o vía "Registrar pago" — lo que
  // manda es: (a) su categoría está ligada a una deuda (p.ej. "Hipoteca"), o
  // (b) tiene un counterAccountId apuntando a una tarjeta de crédito (o sea,
  // este gasto la está pagando) — mismo principio de budgetProgress (ronda 8).
  const debtCategoryIds = useMemo(
    () => new Set(debts.map((d) => d.categoryId).filter(Boolean)),
    [debts]
  )
  const creditAccountIds = useMemo(
    () => new Set(accounts.filter((a) => a.type === 'credito').map((a) => a.id)),
    [accounts]
  )
  const isDebtPaymentExpense = (t) =>
    t.type === 'expense' &&
    !t.convertedToMsi &&
    (debtCategoryIds.has(t.categoryId) || creditAccountIds.has(t.counterAccountId))

  const monthExpenses = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === 'expense' && !t.convertedToMsi && !isDebtPaymentExpense(t))
        .reduce((s, t) => s + t.amount, 0),
    [monthTransactions, debtCategoryIds, creditAccountIds]
  )
  const monthDebtPayments = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === 'debt_payment' || isDebtPaymentExpense(t))
        .reduce((s, t) => s + t.amount, 0),
    [monthTransactions, debtCategoryIds, creditAccountIds]
  )
  // Ajustes manuales de saldo (p.ej. "ya recibí y gasté el ingreso de este
  // mes antes de empezar a registrar") — su monto va firmado, así que sumBy
  // ya los suma/resta correctamente. Cuentan para "Disponible" pero NO para
  // monthIncome/monthIncomeBySource, que solo miran transacciones type='income'.
  const monthAdjustments = useMemo(
    () => sumBy(monthTransactions, 'adjustment'),
    [monthTransactions]
  )
  const available = monthIncome - monthExpenses - monthDebtPayments + monthAdjustments

  const monthIncomeBySource = useMemo(() => {
    const totals = new Map()
    monthTransactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        totals.set(t.incomeSourceId, (totals.get(t.incomeSourceId) || 0) + t.amount)
      })
    return incomeProfiles.map((p) => ({ id: p.id, label: p.label, amount: totals.get(p.id) || 0 }))
  }, [monthTransactions, incomeProfiles])

  const prevMonthIncome = useMemo(() => sumBy(prevMonthTransactions, 'income'), [prevMonthTransactions])
  // Mismo criterio de reclasificación por categoría que monthExpenses, para
  // que el % de cambio vs. el mes anterior compare gastos con gastos.
  const prevMonthExpenses = useMemo(
    () =>
      prevMonthTransactions
        .filter((t) => t.type === 'expense' && !t.convertedToMsi && !isDebtPaymentExpense(t))
        .reduce((s, t) => s + t.amount, 0),
    [prevMonthTransactions, debtCategoryIds, creditAccountIds]
  )

  // Deuda total = deudas registradas + saldo usado de todas las tarjetas de
  // crédito (una tarjeta es su propia deuda implícita vía `used`).
  const totalDebt = useMemo(
    () =>
      debts.reduce((s, d) => s + d.remainingBalance, 0) +
      accounts.filter((a) => a.type === 'credito').reduce((s, a) => s + (a.used || 0), 0),
    [debts, accounts]
  )
  const prevTotalDebt = totalDebt + monthDebtPayments // approx: debt before this month's payments

  const totalSavings = useMemo(
    () => accounts.filter((a) => a.type === 'ahorro').reduce((s, a) => s + (a.balance || 0), 0),
    [accounts]
  )

  // Aportación neta a ahorro este mes (depósitos - retiros) — a diferencia de
  // `totalSavings` (saldo acumulado histórico), esto es el avance del mes en
  // curso, para comparar contra la meta mensual de ahorro.
  const monthSavingsContribution = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === 'saving_movement')
        .reduce((s, t) => s + (t.direction === 'retiro' ? -t.amount : t.amount), 0),
    [monthTransactions]
  )

  // -- Spend by category (current month, expenses + pagos de deuda categorizados) --
  const spendByCategory = useMemo(() => {
    const totals = new Map()
    monthTransactions
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && !t.convertedToMsi)
      .forEach((t) => {
        totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount)
      })
    const total = [...totals.values()].reduce((s, v) => s + v, 0) || 1
    return [...totals.entries()]
      .map(([categoryId, amount]) => ({
        categoryId,
        category: findCategory(categoryId),
        amount,
        percent: (amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthTransactions, findCategory])

  // -- 6-month expense trend ----------------------------------------------
  const trend6Months = useMemo(() => {
    const offsets = [5, 4, 3, 2, 1, 0]
    return offsets.map((offset) => {
      const total = transactions
        .filter((t) => t.type === 'expense' && !t.convertedToMsi && isInMonth(t.date, offset))
        .reduce((s, t) => s + t.amount, 0)
      return {
        offset,
        month: formatMonthLabel(monthStart(offset)),
        total,
      }
    })
  }, [transactions])

  // -- Upcoming debt payments ----------------------------------------------
  // Una deuda cuenta como pagada este mes si se confirmó por el flujo de
  // "Registrar pago" O si ya existe un gasto/pago de este mes en su misma
  // categoría (p.ej. registrado directo desde "Agregar gasto") — la
  // categoría es la única fuente de verdad, no el tipo de transacción.
  const upcomingPayments = useMemo(() => {
    const period = periodKey()
    return debts
      .filter((d) => d.remainingBalance > 0)
      .map((d) => ({
        ...d,
        urgency: getDueUrgency(d.dueDate),
        confirmed:
          debtConfirmations.some((c) => c.debtId === d.id && c.period === period) ||
          (d.categoryId != null &&
            monthTransactions.some(
              (t) =>
                !t.convertedToMsi &&
                t.categoryId === d.categoryId &&
                (t.type === 'expense' || t.type === 'debt_payment')
            )),
      }))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [debts, debtConfirmations, monthTransactions])

  // -- Budget progress -------------------------------------------------
  // El "gastado" de CUALQUIER línea de presupuesto sale exclusivamente de
  // sumar transacciones reales cuyo categoryId coincide — sin excepciones ni
  // categorías con cálculo especial (ver ronda 8: antes "Pago de deuda"/
  // "Ahorro" sumaban aparte por tipo de transacción, sin mirar categoryId,
  // lo que hacía que un mismo pago pareciera contar en dos presupuestos a la
  // vez sin estar realmente ligado a ambos).
  const spentByCategoryId = (txs, categoryId) =>
    txs
      .filter((t) => !t.convertedToMsi && t.categoryId === categoryId)
      .reduce((s, t) => {
        if (t.type === 'expense' || t.type === 'debt_payment') return s + t.amount
        if (t.type === 'saving_movement') return s + (t.direction === 'retiro' ? -t.amount : t.amount)
        return s
      }, 0)

  const budgetProgress = useMemo(() => {
    return budgets.map((b) => {
      const spent = spentByCategoryId(monthTransactions, b.categoryId)
      const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0
      return {
        categoryId: b.categoryId,
        category: findCategory(b.categoryId),
        limit: b.limit,
        spent,
        percent: Math.min(percent, 999),
        status: getBudgetStatus(percent),
        remaining: Math.max(b.limit - spent, 0),
      }
    })
  }, [budgets, monthTransactions, findCategory])

  // Versión histórica de budgetProgress para cualquier mes pasado (offset > 0
  // meses atrás) — el límite mostrado es siempre el ACTUAL de cada categoría
  // (los límites no se versionan por mes, se "repiten" automático), solo el
  // gasto real cambia según el mes que se esté mirando. Usado por el selector
  // de mes en Budgets.jsx; budgetProgress (offset 0) no se toca.
  const getBudgetProgressForOffset = useCallback(
    (offset) => {
      const txs = transactions.filter((t) => isInMonth(t.date, offset))
      return budgets.map((b) => {
        const spent = spentByCategoryId(txs, b.categoryId)
        const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0
        return {
          categoryId: b.categoryId,
          category: findCategory(b.categoryId),
          limit: b.limit,
          spent,
          percent: Math.min(percent, 999),
          status: getBudgetStatus(percent),
          remaining: Math.max(b.limit - spent, 0),
        }
      })
    },
    [transactions, budgets, findCategory]
  )

  // -- Recurring bills: configured once, confirmed manually every period ----
  const recurringStatus = useMemo(() => {
    const period = periodKey()
    return recurringBills.map((bill) => {
      const confirmation = recurringConfirmations.find(
        (c) => c.billId === bill.id && c.period === period
      )
      const daysInMonth = new Date(monthStart(0).getFullYear(), monthStart(0).getMonth() + 1, 0).getDate()
      const dueDate = monthStart(0)
      dueDate.setDate(Math.min(bill.dueDay, daysInMonth))
      return {
        ...bill,
        period,
        confirmed: Boolean(confirmation),
        confirmation: confirmation || null,
        dueDate,
        urgency: confirmation ? 'ok' : getDueUrgency(dueDate),
      }
    })
  }, [recurringBills, recurringConfirmations])

  // -- Notifications: live alerts derived from state + static entries -----
  const liveAlerts = useMemo(() => {
    const list = []
    upcomingPayments.forEach((debt) => {
      if (debt.urgency === 'ok') return
      list.push({
        id: `alert-debt-${debt.id}`,
        kind: 'payment',
        title:
          debt.urgency === 'overdue' ? `Pago vencido: ${debt.name}` : `Pago próximo: ${debt.name}`,
        message: `${formatRelativeDue(debt.dueDate)} · pago mínimo ${formatMoney(debt.minPayment)}`,
        date: debt.dueDate,
        urgency: debt.urgency,
      })
    })
    budgetProgress.forEach((b) => {
      if (b.status === 'ok') return
      list.push({
        id: `alert-budget-${b.categoryId}`,
        kind: 'budget',
        title:
          b.status === 'danger'
            ? `Presupuesto superado: ${b.category.label}`
            : `Presupuesto cerca del límite: ${b.category.label}`,
        message: `${formatPercent(b.percent)} usado · ${formatMoney(b.spent)} de ${formatMoney(b.limit)}`,
        date: new Date(),
        urgency: b.status === 'danger' ? 'urgent' : 'soon',
      })
    })
    recurringStatus.forEach((bill) => {
      if (bill.confirmed || bill.urgency === 'ok') return
      list.push({
        id: `alert-recurring-${bill.id}`,
        kind: 'recurring',
        title:
          bill.urgency === 'overdue'
            ? `Pago recurrente vencido: ${bill.name}`
            : `Pago recurrente próximo: ${bill.name}`,
        message: `${formatRelativeDue(bill.dueDate)} · estimado ${formatMoney(bill.estimatedAmount)} · confirma cuando se cobre`,
        date: bill.dueDate,
        urgency: bill.urgency,
      })
    })
    return list
  }, [upcomingPayments, budgetProgress, recurringStatus])

  const notifications = useMemo(() => {
    const merged = [
      ...liveAlerts.map((a) => ({ ...a, read: readIds.has(a.id) })),
      ...STATIC_NOTIFICATIONS.map((n) => ({ ...n, read: n.read || readIds.has(n.id) })),
    ]
    return merged.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [liveAlerts, readIds])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markNotificationRead = useCallback((id) => {
    setReadIds((prev) => new Set(prev).add(id))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      notifications.forEach((n) => next.add(n.id))
      return next
    })
  }, [notifications])

  // -- Actions --------------------------------------------------------
  const addExpense = useCallback(
    ({ amount, categoryId, subcategoryId, accountId, counterAccountId, note, date }) => {
      const tx = {
        id: nextLocalId('exp'),
        type: 'expense',
        amount: Number(amount),
        categoryId,
        subcategoryId: subcategoryId || null,
        accountId,
        counterAccountId: counterAccountId || null,
        note: note?.trim() || findCategoryLabel(categoryId),
        date: date ? parseDateInputValue(date) : new Date(),
        createdBy: authUser?.uid || null,
      }
      setTransactions((prev) => [tx, ...prev])
      setAccounts((prev) => applyExpenseEffect(prev, accountId, Number(amount), 1, counterAccountId))
      return tx
    },
    [authUser]
  )

  function findCategoryLabel(id) {
    return getCategory(id).label
  }

  const addIncome = useCallback(
    (data) => {
      const { sourceId, accountId, note, date } = data
      const profile = findIncomeProfile(sourceId)
      let tx
      if (profile.mode === 'resico') {
        const gross = Number(data.grossAmount)
        const ivaPercent = Number(data.ivaPercent) || 0
        const isrPercent = Number(data.isrPercent) || 0
        const ivaAmount = Math.round((gross * ivaPercent) / 100)
        const isrAmount = Math.round((gross * isrPercent) / 100)
        tx = {
          id: nextLocalId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          grossAmount: gross,
          ivaPercent,
          ivaAmount,
          isrPercent,
          isrAmount,
          amount: gross - ivaAmount - isrAmount,
          accountId,
          note: note?.trim() || profile.label,
          date: date ? parseDateInputValue(date) : new Date(),
        }
      } else if (profile.mode === 'hourly') {
        const payMode = data.payMode === 'hours' ? 'hours' : 'total'
        const amount =
          payMode === 'hours'
            ? Math.round(Number(data.hours) * Number(data.hourlyRate))
            : Number(data.amount)
        tx = {
          id: nextLocalId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          payMode,
          ...(payMode === 'hours' && { hours: Number(data.hours), hourlyRate: Number(data.hourlyRate) }),
          amount,
          accountId,
          note: note?.trim() || profile.label,
          date: date ? parseDateInputValue(date) : new Date(),
        }
      } else {
        tx = {
          id: nextLocalId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          amount: Number(data.amount),
          accountId,
          note: note?.trim() || profile.label,
          date: date ? parseDateInputValue(date) : new Date(),
        }
      }
      tx.createdBy = authUser?.uid || null
      setTransactions((prev) => [tx, ...prev])
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id !== accountId || acc.type === 'credito') return acc
          return { ...acc, balance: acc.balance + tx.amount }
        })
      )
      return tx
    },
    [findIncomeProfile, authUser]
  )

  const addIncomeProfile = useCallback((profile) => {
    const base = {
      id: nextLocalId('profile'),
      label: profile.label?.trim() || 'Nuevo perfil',
      mode: profile.mode || 'fixed',
      payFrequency: profile.payFrequency || 'mensual',
    }
    const modeFields =
      base.mode === 'resico'
        ? {
            defaultIvaPercent: Number(profile.defaultIvaPercent) || 0,
            defaultIsrPercent: Number(profile.defaultIsrPercent) || 0,
          }
        : base.mode === 'hourly'
          ? { defaultHourlyRate: Number(profile.defaultHourlyRate) || 0 }
          : { defaultAmount: Number(profile.defaultAmount) || 0 }
    const p = { ...base, ...modeFields }
    setIncomeProfiles((prev) => [...prev, p])
    return p
  }, [])

  const updateIncomeProfile = useCallback((id, patch) => {
    setIncomeProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const removeIncomeProfile = useCallback((id) => {
    setIncomeProfiles((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addAccount = useCallback((account) => {
    const acc = {
      id: nextLocalId('acc'),
      name: account.name,
      bank: account.bank || null,
      type: account.type,
      last4: account.last4 || null,
      gradient: account.gradient || 'from-slate-600 via-slate-700 to-slate-900',
      ...(account.type === 'credito'
        ? { used: Number(account.used) || 0, limit: Number(account.limit) || 0 }
        : { balance: Number(account.balance) || 0 }),
      ...(account.type === 'ahorro' && account.goal ? { goal: Number(account.goal) || 0 } : {}),
    }
    setAccounts((prev) => [...prev, acc])
    return acc
  }, [])

  // Corrección directa y silenciosa de los datos de una cuenta ya creada
  // (nombre, saldo, usado/límite, meta) — sin transacción ni historial, a
  // diferencia de "Ajustar saldo" (addBalanceAdjustment), que sí registra un
  // movimiento visible en Disponible este mes.
  const updateAccount = useCallback((accountId, patch) => {
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, ...patch } : a)))
  }, [])

  // Mueve dinero hacia (depósito) o desde (retiro) una cuenta de ahorro. Es
  // una transacción propia (`saving_movement`), no un ingreso ni un gasto —
  // así no distorsiona monthIncome/monthExpenses, igual que ya pasa con los
  // pagos de deuda.
  const registerSavingMovement = useCallback(
    ({ accountId, counterAccountId, amount, direction, note, date, categoryId }) => {
      const value = Number(amount)
      const isDeposit = direction !== 'retiro'

      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === accountId) {
            return { ...acc, balance: isDeposit ? acc.balance + value : acc.balance - value }
          }
          if (counterAccountId && acc.id === counterAccountId) {
            if (isDeposit) {
              // El dinero sale de la cuenta contraparte, igual que un gasto.
              if (acc.type === 'credito') return { ...acc, used: acc.used + value }
              return { ...acc, balance: acc.balance - value }
            }
            // Retiro: el dinero entra a la cuenta contraparte, igual que un ingreso.
            if (acc.type === 'credito') return acc
            return { ...acc, balance: acc.balance + value }
          }
          return acc
        })
      )

      const tx = {
        id: nextLocalId('sav'),
        type: 'saving_movement',
        accountId,
        counterAccountId: counterAccountId || null,
        categoryId,
        amount: value,
        direction: isDeposit ? 'deposito' : 'retiro',
        note: note?.trim() || (isDeposit ? 'Depósito a ahorro' : 'Retiro de ahorro'),
        date: date ? parseDateInputValue(date) : new Date(),
        createdBy: authUser?.uid || null,
      }
      setTransactions((prev) => [tx, ...prev])
      return tx
    },
    [authUser]
  )

  // Corrige el saldo de una cuenta (débito/efectivo) para "partir de un punto
  // realista" — p.ej. empezar a medio mes con el ingreso ya recibido y
  // gastado sin registrar cada transacción. Es su propia transacción
  // (`adjustment`, monto firmado) que sí cuenta para "Disponible este mes"
  // pero no para monthIncome — así no se infla el ingreso real ni su
  // desglose por fuente.
  const addBalanceAdjustment = useCallback(({ accountId, amount, direction, note, date }) => {
    const magnitude = Number(amount)
    const signedAmount = direction === 'decrease' ? -magnitude : magnitude

    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, balance: acc.balance + signedAmount } : acc))
    )

    const tx = {
      id: nextLocalId('adj'),
      type: 'adjustment',
      accountId,
      amount: signedAmount,
      note: note?.trim() || 'Ajuste de saldo',
      date: date ? parseDateInputValue(date) : new Date(),
      createdBy: authUser?.uid || null,
    }
    setTransactions((prev) => [tx, ...prev])
    return tx
  }, [authUser])

  // Revierte un ajuste de saldo — resta de la cuenta el mismo monto firmado
  // que addBalanceAdjustment le sumó.
  const deleteBalanceAdjustment = useCallback(
    (transactionId) => {
      const tx = transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'adjustment') return
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === tx.accountId ? { ...acc, balance: acc.balance - tx.amount } : acc))
      )
    },
    [transactions]
  )

  const registerDebtPayment = useCallback((debtId, amount, accountId) => {
    const value = Number(amount)
    const categoryId = debts.find((d) => d.id === debtId)?.categoryId || null
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d
        const remainingBalance = Math.max(d.remainingBalance - value, 0)
        if (d.kind === 'msi') {
          // installmentsPaid se calcula a partir de lo realmente pagado (no
          // +1 fijo por pago) — así un pago parcial o un abono mayor a una
          // cuota no desincroniza el contador del saldo real. `stillOwes`
          // depende solo de remainingBalance: antes, si installmentsPaid
          // llegaba al tope con saldo aún pendiente (pagos parciales), la
          // fecha de corte/límite dejaba de avanzar para siempre.
          const installmentsPaid =
            d.totalAmount > 0
              ? Math.min(Math.round(((d.totalAmount - remainingBalance) / d.totalAmount) * d.installments), d.installments)
              : d.installments
          const stillOwes = remainingBalance > 0
          return {
            ...d,
            remainingBalance,
            installmentsPaid,
            dueDate: stillOwes ? addMonths(d.dueDate, 1) : d.dueDate,
            cutDate: stillOwes ? addMonths(d.cutDate, 1) : d.cutDate,
          }
        }
        return { ...d, remainingBalance }
      })
    )
    const payDate = new Date()
    const txId = nextLocalId('pay')
    setTransactions((prev) => [
      {
        id: txId,
        type: 'debt_payment',
        debtId,
        categoryId,
        amount: value,
        accountId,
        note: 'Pago de deuda',
        date: payDate,
        createdBy: authUser?.uid || null,
      },
      ...prev,
    ])
    setAccounts((prev) => applyDebtPaymentEffect(prev, accountId, value, 1))
    setDebtConfirmations((prev) => [
      ...prev,
      { debtId, period: periodKey(), transactionId: txId, amount: value, date: payDate },
    ])
  }, [debts, authUser])

  const updateDebt = useCallback((debtId, updates) => {
    setDebts((prev) => prev.map((d) => (d.id === debtId ? { ...d, ...updates } : d)))
  }, [])

  // Edita una transacción ya registrada — gasto normal o pago de deuda.
  // No se permite tocar transacciones convertidas a MSI (desincronizaría la
  // deuda MSI que generaron) ni reasignar un pago de deuda a otra deuda.
  const updateTransaction = useCallback(
    (transactionId, updates) => {
      const old = transactions.find((t) => t.id === transactionId)
      if (!old) return
      if (old.type === 'expense') {
        if (old.convertedToMsi) return
        const nextAmount = updates.amount != null ? Number(updates.amount) : old.amount
        const nextAccountId = updates.accountId || old.accountId
        const nextCounterAccountId =
          updates.counterAccountId !== undefined ? updates.counterAccountId : old.counterAccountId
        const next = {
          ...old,
          ...updates,
          amount: nextAmount,
          accountId: nextAccountId,
          date: updates.date ? parseDateInputValue(updates.date) : old.date,
        }
        setTransactions((prev) => prev.map((t) => (t.id === transactionId ? next : t)))
        setAccounts((prev) => {
          const reverted = applyExpenseEffect(prev, old.accountId, old.amount, -1, old.counterAccountId)
          return applyExpenseEffect(reverted, nextAccountId, nextAmount, 1, nextCounterAccountId)
        })
      } else if (old.type === 'debt_payment') {
        const nextAmount = updates.amount != null ? Number(updates.amount) : old.amount
        const nextAccountId = updates.accountId || old.accountId
        const nextDate = updates.date ? parseDateInputValue(updates.date) : old.date
        const delta = nextAmount - old.amount
        const next = { ...old, ...updates, debtId: old.debtId, amount: nextAmount, accountId: nextAccountId, date: nextDate }
        setTransactions((prev) => prev.map((t) => (t.id === transactionId ? next : t)))
        setDebts((prev) =>
          prev.map((d) => (d.id === old.debtId ? { ...d, remainingBalance: Math.max(d.remainingBalance - delta, 0) } : d))
        )
        setAccounts((prev) => {
          const reverted = applyDebtPaymentEffect(prev, old.accountId, old.amount, -1)
          return applyDebtPaymentEffect(reverted, nextAccountId, nextAmount, 1)
        })
        if (updates.date) {
          setDebtConfirmations((prev) =>
            prev.map((c) =>
              c.transactionId === transactionId ? { ...c, period: periodKey(nextDate), amount: nextAmount } : c
            )
          )
        } else if (updates.amount != null) {
          setDebtConfirmations((prev) =>
            prev.map((c) => (c.transactionId === transactionId ? { ...c, amount: nextAmount } : c))
          )
        }
      }
    },
    [transactions]
  )

  // Elimina una transacción ya registrada, revirtiendo todos sus efectos:
  // saldo de cuenta, saldo de la deuda (+cuota/fechas si era MSI), y la
  // confirmación mensual (recurrente o pago de deuda) que la haya generado.
  const deleteTransaction = useCallback(
    (transactionId) => {
      const tx = transactions.find((t) => t.id === transactionId)
      if (!tx) return
      if (tx.type === 'expense') {
        if (tx.convertedToMsi) return
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
        setAccounts((prev) => applyExpenseEffect(prev, tx.accountId, tx.amount, -1, tx.counterAccountId))
        setRecurringConfirmations((prev) => prev.filter((c) => c.transactionId !== transactionId))
      } else if (tx.type === 'debt_payment') {
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
        setAccounts((prev) => applyDebtPaymentEffect(prev, tx.accountId, tx.amount, -1))
        setDebts((prev) =>
          prev.map((d) => {
            if (d.id !== tx.debtId) return d
            const remainingBalance = Math.min(d.remainingBalance + tx.amount, d.totalAmount)
            if (d.kind === 'msi') {
              const installmentsPaid =
                d.totalAmount > 0
                  ? Math.min(Math.round(((d.totalAmount - remainingBalance) / d.totalAmount) * d.installments), d.installments)
                  : 0
              return {
                ...d,
                remainingBalance,
                installmentsPaid,
                dueDate: addMonths(d.dueDate, -1),
                cutDate: addMonths(d.cutDate, -1),
              }
            }
            return { ...d, remainingBalance }
          })
        )
        setDebtConfirmations((prev) => prev.filter((c) => c.transactionId !== transactionId))
      }
    },
    [transactions]
  )

  const addExpenseDeferred = useCallback(
    ({ amount, months, interestFree, monthlyRate, categoryId, subcategoryId, accountId, note, date }) => {
      const value = Number(amount)
      const rate = interestFree ? 0 : Number(monthlyRate) || 0
      const totalAmount = interestFree ? value : Math.round(value * (1 + (rate / 100) * months))
      const startDate = date ? parseDateInputValue(date) : new Date()
      const debt = {
        id: nextLocalId('msi'),
        name: note?.trim() || findCategory(categoryId).label,
        type: 'Meses sin intereses',
        kind: 'msi',
        installments: months,
        installmentsPaid: 0,
        interestFree,
        categoryId,
        subcategoryId: subcategoryId || null,
        accountId,
        totalAmount,
        remainingBalance: totalAmount,
        interestRate: rate,
        cutDate: startDate,
        dueDate: addMonths(startDate, 1),
        minPayment: Math.round(totalAmount / months),
      }
      setDebts((prev) => [...prev, debt])
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id !== accountId) return acc
          if (acc.type === 'credito') return { ...acc, used: acc.used + value }
          return { ...acc, balance: acc.balance - value }
        })
      )
      return debt
    },
    [findCategory]
  )

  const convertExpenseToMSI = useCallback(
    (transactionId, { months, interestFree, monthlyRate }) => {
      const tx = transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'expense' || tx.convertedToMsi) return null
      const rate = interestFree ? 0 : Number(monthlyRate) || 0
      const totalAmount = interestFree ? tx.amount : Math.round(tx.amount * (1 + (rate / 100) * months))
      const debt = {
        id: nextLocalId('msi'),
        name: tx.note || findCategory(tx.categoryId).label,
        type: 'Meses sin intereses',
        kind: 'msi',
        installments: months,
        installmentsPaid: 0,
        interestFree,
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId || null,
        accountId: tx.accountId,
        totalAmount,
        remainingBalance: totalAmount,
        interestRate: rate,
        cutDate: new Date(tx.date),
        dueDate: addMonths(tx.date, 1),
        minPayment: Math.round(totalAmount / months),
        sourceTransactionId: tx.id,
      }
      setDebts((prev) => [...prev, debt])
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, convertedToMsi: true } : t)))
      return debt
    },
    [transactions, findCategory]
  )

  const confirmRecurringPayment = useCallback(
    (billId, { amount, accountId, date } = {}) => {
      const bill = recurringBills.find((b) => b.id === billId)
      if (!bill) return null
      const tx = addExpense({
        amount: amount ?? bill.estimatedAmount,
        categoryId: bill.categoryId,
        accountId: accountId || bill.accountId,
        note: bill.name,
        date: date || new Date(),
      })
      setRecurringConfirmations((prev) => [
        ...prev,
        { billId, period: periodKey(), transactionId: tx.id, amount: tx.amount, date: tx.date },
      ])
      return tx
    },
    [recurringBills, addExpense]
  )

  const upsertRecurringBill = useCallback((bill) => {
    setRecurringBills((prev) => {
      if (bill.id && prev.some((b) => b.id === bill.id)) {
        return prev.map((b) => (b.id === bill.id ? { ...b, ...bill } : b))
      }
      return [...prev, { ...bill, id: nextLocalId('rec') }]
    })
  }, [])

  const removeRecurringBill = useCallback((id) => {
    setRecurringBills((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const upsertBudget = useCallback((categoryId, limit) => {
    setBudgets((prev) => {
      const exists = prev.some((b) => b.categoryId === categoryId)
      if (exists) {
        return prev.map((b) => (b.categoryId === categoryId ? { ...b, limit: Number(limit) } : b))
      }
      return [...prev, { categoryId, limit: Number(limit) }]
    })
  }, [])

  const removeBudget = useCallback((categoryId) => {
    setBudgets((prev) => prev.filter((b) => b.categoryId !== categoryId))
  }, [])

  // Techo total del presupuesto del mes — un solo valor vigente (no se
  // versiona por mes, igual que los límites por categoría).
  const setBudgetTotalLimit = useCallback((value) => {
    setBudgetTotalLimitState(value === '' || value == null ? null : Number(value))
  }, [])

  const addCategory = useCallback((category) => {
    const cat = {
      id: nextLocalId('cat'),
      label: category.label,
      iconId: category.icon, // el picker pasa el id string del icono
      icon: getIconById(category.icon),
      colorVar: null,
      color: category.color,
    }
    setCustomCategories((prev) => [...prev, cat])
    return cat
  }, [])

  const removeCategory = useCallback((id) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id))
    setBudgets((prev) => prev.filter((b) => b.categoryId !== id))
  }, [])

  const value = {
    accounts,
    transactions,
    debts,
    budgets,
    allCategories,
    customCategories,
    findCategory,

    monthIncome,
    monthExpenses,
    monthDebtPayments,
    monthAdjustments,
    available,
    monthIncomeBySource,
    prevMonthIncome,
    prevMonthExpenses,
    totalDebt,
    prevTotalDebt,
    totalSavings,
    monthSavingsContribution,
    spendByCategory,
    trend6Months,
    upcomingPayments,
    budgetProgress,
    getBudgetProgressForOffset,
    budgetTotalLimit,
    setBudgetTotalLimit,

    incomeProfiles,
    findIncomeProfile,
    addIncomeProfile,
    updateIncomeProfile,
    removeIncomeProfile,
    addIncome,

    recurringBills,
    recurringStatus,
    confirmRecurringPayment,
    upsertRecurringBill,
    removeRecurringBill,

    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,

    addExpense,
    addExpenseDeferred,
    convertExpenseToMSI,
    addAccount,
    updateAccount,
    registerDebtPayment,
    updateDebt,
    updateTransaction,
    deleteTransaction,
    registerSavingMovement,
    addBalanceAdjustment,
    deleteBalanceAdjustment,
    upsertBudget,
    removeBudget,
    addCategory,
    removeCategory,

    // Persistencia / respaldo del perfil
    hydrated,
    dirty,
    saveState,
    lastSavedAt,
    remoteAhead,
    saveProfile,
    discardLocalAndSyncRemote,
    exportProfile,
    importProfile,
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de FinanceProvider')
  return ctx
}
