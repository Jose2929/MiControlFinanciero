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
} from '../lib/format'

const FinanceContext = createContext(null)

let localIdCounter = 1000
const nextLocalId = (prefix) => `${prefix}-${(localIdCounter += 1)}`
const getIdCounter = () => localIdCounter
// Al rehidratar un perfil guardado subimos el contador por encima del último
// id usado para que los ids nuevos no colisionen con los restaurados.
const bumpIdCounter = (n) => {
  if (Number.isFinite(n) && n > localIdCounter) localIdCounter = n
}

export function FinanceProvider({ children, store: providedStore }) {
  const { user: authUser } = useAuth()
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
    setReadIds(data.readIds)
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
        readIds,
        idCounter: getIdCounter(),
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
      readIds,
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

    const unsubscribe = store.subscribe((raw) => {
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
    })
    return unsubscribe
  }, [store, applyProfile])

  // Marca "cambios sin guardar" cuando cambia cualquier slice serializable.
  // Se ignoran: el primer render posterior a la hidratación (dirtyGuard) y
  // los cambios que vinieron de aplicar un snapshot remoto (remoteApplyRef).
  useEffect(() => {
    if (!hydrated) return
    if (remoteApplyRef.current) {
      remoteApplyRef.current = false
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
        setSaveState('error')
        throw err
      }
    },
    [buildSnapshot, store]
  )

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
  // Expenses converted to MSI are no longer a lump-sum outflow — they're
  // replaced by the debt's future installment payments — so they're excluded
  // here to avoid double-counting (they still show, struck through, in Gastos).
  const sumExpenses = (list) =>
    list.filter((t) => t.type === 'expense' && !t.convertedToMsi).reduce((s, t) => s + t.amount, 0)

  const monthIncome = useMemo(() => sumBy(monthTransactions, 'income'), [monthTransactions])
  const monthExpenses = useMemo(() => sumExpenses(monthTransactions), [monthTransactions])
  const monthDebtPayments = useMemo(
    () => sumBy(monthTransactions, 'debt_payment'),
    [monthTransactions]
  )
  const available = monthIncome - monthExpenses - monthDebtPayments

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
  const prevMonthExpenses = useMemo(() => sumExpenses(prevMonthTransactions), [prevMonthTransactions])

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + d.remainingBalance, 0), [debts])
  const prevTotalDebt = totalDebt + monthDebtPayments // approx: debt before this month's payments

  // -- Spend by category (current month, expenses only) ------------------
  const spendByCategory = useMemo(() => {
    const totals = new Map()
    monthTransactions
      .filter((t) => t.type === 'expense' && !t.convertedToMsi)
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
  const upcomingPayments = useMemo(
    () =>
      debts
        .filter((d) => d.remainingBalance > 0)
        .map((d) => ({ ...d, urgency: getDueUrgency(d.dueDate) }))
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [debts]
  )

  // -- Budget progress -------------------------------------------------
  const budgetProgress = useMemo(() => {
    return budgets.map((b) => {
      const spent = monthTransactions
        .filter((t) => t.type === 'expense' && !t.convertedToMsi && t.categoryId === b.categoryId)
        .reduce((s, t) => s + t.amount, 0)
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
  const addExpense = useCallback(({ amount, categoryId, subcategoryId, accountId, note, date }) => {
    const tx = {
      id: nextLocalId('exp'),
      type: 'expense',
      amount: Number(amount),
      categoryId,
      subcategoryId: subcategoryId || null,
      accountId,
      note: note?.trim() || findCategoryLabel(categoryId),
      date: date ? new Date(date) : new Date(),
    }
    setTransactions((prev) => [tx, ...prev])
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== accountId) return acc
        if (acc.type === 'credito') return { ...acc, used: acc.used + Number(amount) }
        return { ...acc, balance: acc.balance - Number(amount) }
      })
    )
    return tx
  }, [])

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
          date: date ? new Date(date) : new Date(),
        }
      } else if (profile.mode === 'hourly') {
        const payMode = data.payMode === 'hours' ? 'hours' : 'total'
        const amount =
          payMode === 'hours' ? Number(data.hours) * Number(data.hourlyRate) : Number(data.amount)
        tx = {
          id: nextLocalId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          payMode,
          hours: payMode === 'hours' ? Number(data.hours) : undefined,
          hourlyRate: payMode === 'hours' ? Number(data.hourlyRate) : undefined,
          amount,
          accountId,
          note: note?.trim() || profile.label,
          date: date ? new Date(date) : new Date(),
        }
      } else {
        tx = {
          id: nextLocalId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          amount: Number(data.amount),
          accountId,
          note: note?.trim() || profile.label,
          date: date ? new Date(date) : new Date(),
        }
      }
      setTransactions((prev) => [tx, ...prev])
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id !== accountId || acc.type === 'credito') return acc
          return { ...acc, balance: acc.balance + tx.amount }
        })
      )
      return tx
    },
    [findIncomeProfile]
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
    }
    setAccounts((prev) => [...prev, acc])
    return acc
  }, [])

  const registerDebtPayment = useCallback((debtId, amount, accountId) => {
    const value = Number(amount)
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d
        const remainingBalance = Math.max(d.remainingBalance - value, 0)
        if (d.kind === 'msi') {
          const installmentsPaid = Math.min((d.installmentsPaid || 0) + 1, d.installments)
          const stillOwes = remainingBalance > 0 && installmentsPaid < d.installments
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
    setTransactions((prev) => [
      {
        id: nextLocalId('pay'),
        type: 'debt_payment',
        debtId,
        amount: value,
        accountId,
        note: 'Pago de deuda',
        date: new Date(),
      },
      ...prev,
    ])
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== accountId) return acc
        if (acc.type === 'credito') return { ...acc, used: Math.max(acc.used - value, 0) }
        return { ...acc, balance: acc.balance - value }
      })
    )
  }, [])

  const addExpenseDeferred = useCallback(
    ({ amount, months, interestFree, monthlyRate, categoryId, subcategoryId, accountId, note, date }) => {
      const value = Number(amount)
      const rate = interestFree ? 0 : Number(monthlyRate) || 0
      const totalAmount = interestFree ? value : Math.round(value * (1 + (rate / 100) * months))
      const startDate = date ? new Date(date) : new Date()
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
    available,
    monthIncomeBySource,
    prevMonthIncome,
    prevMonthExpenses,
    totalDebt,
    prevTotalDebt,
    spendByCategory,
    trend6Months,
    upcomingPayments,
    budgetProgress,

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
    registerDebtPayment,
    upsertBudget,
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
