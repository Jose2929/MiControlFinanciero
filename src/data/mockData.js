import { daysFromNow, startOfDay, monthStart, monthEnd } from '../lib/format'

// Deterministic PRNG so the mock dataset looks the same across reloads
// within a session (nicer for demos/screenshots) without needing a backend.
function mulberry32(seed) {
  let a = seed
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20260804)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const between = (min, max) => Math.round(min + rng() * (max - min))

let idCounter = 0
const nextId = (prefix) => `${prefix}-${(idCounter += 1)}`

function randomDateInMonth(offset) {
  const start = monthStart(offset).getTime()
  const end = monthEnd(offset).getTime()
  const t = start + rng() * Math.max(end - start, 0)
  return startOfDay(new Date(t))
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const ACCOUNTS = [
  {
    id: 'acc-bbva',
    name: 'Tarjeta BBVA',
    bank: 'BBVA',
    type: 'credito',
    last4: '4821',
    used: 8200,
    limit: 15000,
    gradient: 'from-sky-600 via-blue-700 to-indigo-900',
  },
  {
    id: 'acc-nu',
    name: 'Cuenta Nu',
    bank: 'Nu',
    type: 'debito',
    last4: '9034',
    balance: 12480,
    gradient: 'from-violet-600 via-purple-700 to-fuchsia-900',
  },
  {
    id: 'acc-santander',
    name: 'Tarjeta Santander',
    bank: 'Santander',
    type: 'credito',
    last4: '1187',
    used: 1800,
    limit: 10000,
    gradient: 'from-rose-600 via-red-700 to-red-950',
  },
  {
    id: 'acc-efectivo',
    name: 'Efectivo',
    bank: null,
    type: 'efectivo',
    last4: null,
    balance: 650,
    gradient: 'from-emerald-600 via-emerald-700 to-teal-900',
  },
]

// ---------------------------------------------------------------------------
// Income profiles — an open list of income sources that roll up into one
// combined total. Each profile picks a calculation `mode`:
//   'resico' — gross amount minus SAT withholdings (IVA trasladado + ISR
//              RESICO) nets out to what's actually available.
//   'hourly' — paid hourly (hours × rate) or as a direct monthly total,
//              chosen per entry, since the amount varies period to period.
//   'fixed'  — a plain fixed amount captured directly, no calculation.
// New profiles can be added later (e.g. a third income source) without
// touching this shape.
// ---------------------------------------------------------------------------

export const INCOME_PROFILES_CONFIG = [
  {
    id: 'mine',
    label: 'Mi ingreso (RESICO)',
    mode: 'resico',
    payFrequency: 'quincenal',
    defaultIvaPercent: 16,
    defaultIsrPercent: 1.5,
  },
  {
    id: 'spouse',
    label: 'Ingreso de tu esposa',
    mode: 'hourly',
    payFrequency: 'mensual',
    defaultHourlyRate: 150,
  },
]

// ---------------------------------------------------------------------------
// Transactions: incomes + expenses across the last 6 months, plus a couple
// of debt payments so the dashboard equation has real movement this month.
// ---------------------------------------------------------------------------

const EXPENSE_PROFILE = [
  { categoryId: 'comida', count: [8, 12], amount: [80, 450], notes: ['Súper', 'Restaurante', 'Café', 'Comida rápida', 'Antojitos', 'Mercado'] },
  { categoryId: 'transporte', count: [4, 8], amount: [40, 320], notes: ['Gasolina', 'Uber', 'Metro', 'Estacionamiento', 'Casetas'] },
  { categoryId: 'renta', count: [1, 1], amount: [6800, 7200], notes: ['Renta departamento'] },
  { categoryId: 'entretenimiento', count: [2, 4], amount: [150, 600], notes: ['Cine', 'Streaming', 'Salida con amigos', 'Concierto'] },
  { categoryId: 'salud', count: [1, 3], amount: [200, 1200], notes: ['Farmacia', 'Consulta médica', 'Gimnasio'] },
  { categoryId: 'compras', count: [2, 5], amount: [200, 1500], notes: ['Ropa', 'Amazon', 'Artículos para el hogar', 'Regalo'] },
  { categoryId: 'servicios', count: [3, 5], amount: [280, 1150], notes: ['Luz (CFE)', 'Internet', 'Agua', 'Celular', 'Netflix'] },
  { categoryId: 'otros', count: [1, 3], amount: [100, 500], notes: ['Varios', 'Comisión bancaria', 'Donativo'] },
]

const EXPENSE_ACCOUNTS = ['acc-bbva', 'acc-nu', 'acc-santander', 'acc-efectivo']

// For the current month, transactions can only fall between day 1 and today —
// scale expense volume to that elapsed slice so day 4 doesn't already look
// like a full month of spending crammed into four days.
function monthElapsedFraction(offset) {
  if (offset !== 0) return 1
  const start = monthStart(0)
  const today = monthEnd(0)
  const elapsedDays = Math.round((today - start) / 86400000) + 1
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return Math.min(Math.max(elapsedDays / totalDays, 0.12), 1)
}

// 'quincenal' pays on the 1st and 15th; anything else (e.g. 'mensual') pays
// once, on a random day near the end of the month.
function payDaysForFrequency(frequency, offset) {
  if (frequency === 'quincenal') return [1, 15]
  return [Math.min(between(24, 28), monthEnd(offset).getDate())]
}

function buildMonthTransactions(offset) {
  const items = []
  const fraction = monthElapsedFraction(offset)

  for (const profile of INCOME_PROFILES_CONFIG) {
    for (const day of payDaysForFrequency(profile.payFrequency, offset)) {
      const d = monthStart(offset)
      d.setDate(day)
      if (d > monthEnd(offset)) continue

      if (profile.mode === 'resico') {
        const gross = between(9200, 9800)
        const ivaPercent = profile.defaultIvaPercent
        const isrPercent = profile.defaultIsrPercent
        const ivaAmount = Math.round((gross * ivaPercent) / 100)
        const isrAmount = Math.round((gross * isrPercent) / 100)
        items.push({
          id: nextId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          grossAmount: gross,
          ivaPercent,
          ivaAmount,
          isrPercent,
          isrAmount,
          amount: gross - ivaAmount - isrAmount,
          note: 'Pago de servicios profesionales',
          accountId: 'acc-nu',
          date: startOfDay(d),
        })
      } else if (profile.mode === 'hourly') {
        const hours = between(140, 190)
        const hourlyRate = profile.defaultHourlyRate + between(-10, 10)
        items.push({
          id: nextId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          payMode: 'hours',
          hours,
          hourlyRate,
          amount: hours * hourlyRate,
          note: 'Pago mensual por horas',
          accountId: 'acc-nu',
          date: startOfDay(d),
        })
      } else {
        items.push({
          id: nextId('inc'),
          type: 'income',
          incomeSourceId: profile.id,
          amount: profile.defaultAmount ?? 5000,
          note: profile.label,
          accountId: 'acc-nu',
          date: startOfDay(d),
        })
      }
    }
  }

  for (const profile of EXPENSE_PROFILE) {
    const fullCount = between(profile.count[0], profile.count[1])
    const count = profile.categoryId === 'renta' ? fullCount : Math.round(fullCount * fraction)
    for (let i = 0; i < count; i += 1) {
      items.push({
        id: nextId('exp'),
        type: 'expense',
        categoryId: profile.categoryId,
        amount: between(profile.amount[0], profile.amount[1]),
        note: pick(profile.notes),
        accountId: pick(EXPENSE_ACCOUNTS),
        date: randomDateInMonth(offset),
      })
    }
  }

  return items
}

const historicalTransactions = [0, 1, 2, 3, 4, 5].flatMap(buildMonthTransactions)

const debtPaymentTransactions = [
  {
    id: nextId('pay'),
    type: 'debt_payment',
    debtId: 'debt-santander',
    amount: 900,
    note: 'Pago tarjeta Santander',
    accountId: 'acc-nu',
    date: daysFromNow(-6),
  },
  {
    id: nextId('pay'),
    type: 'debt_payment',
    debtId: 'debt-msi-tv',
    amount: 1000,
    note: 'Pago MSI · Pantalla Samsung 55"',
    accountId: 'acc-bbva',
    date: daysFromNow(-20),
  },
]

// A couple of illustrative Bebé/Mascotas purchases so the new categories
// aren't empty in the demo (real history comes in a later data-loading pass).
const familyTransactions = [
  {
    id: nextId('exp'),
    type: 'expense',
    categoryId: 'bebe',
    subcategoryId: 'panales',
    amount: 450,
    note: 'Pañales talla 3',
    accountId: 'acc-nu',
    date: daysFromNow(-2),
  },
  {
    id: nextId('exp'),
    type: 'expense',
    categoryId: 'mascotas',
    subcategoryId: 'alimento-mascota',
    amount: 380,
    note: 'Croquetas',
    accountId: 'acc-efectivo',
    date: daysFromNow(-1),
  },
]

export const TRANSACTIONS = [
  ...historicalTransactions,
  ...debtPaymentTransactions,
  ...familyTransactions,
].sort((a, b) => b.date - a.date)

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export const DEBTS = [
  {
    id: 'debt-bbva',
    name: 'Tarjeta BBVA',
    type: 'Tarjeta de crédito',
    kind: 'debt',
    accountId: 'acc-bbva',
    totalAmount: 15000,
    remainingBalance: 8200,
    interestRate: 42.5,
    cutDate: daysFromNow(-2),
    dueDate: daysFromNow(3),
    minPayment: 950,
  },
  {
    id: 'debt-personal',
    name: 'Préstamo personal',
    type: 'Préstamo personal',
    kind: 'debt',
    accountId: null,
    totalAmount: 30000,
    remainingBalance: 21000,
    interestRate: 24,
    cutDate: daysFromNow(-9),
    dueDate: daysFromNow(1),
    minPayment: 2500,
  },
  {
    id: 'debt-santander',
    name: 'Tarjeta Santander',
    type: 'Tarjeta de crédito',
    kind: 'debt',
    accountId: 'acc-santander',
    totalAmount: 10000,
    remainingBalance: 1800,
    interestRate: 38,
    cutDate: daysFromNow(2),
    dueDate: daysFromNow(14),
    minPayment: 400,
  },
  {
    id: 'debt-moto',
    name: 'Crédito moto',
    type: 'Crédito automotriz',
    kind: 'debt',
    accountId: null,
    totalAmount: 45000,
    remainingBalance: 39500,
    interestRate: 16,
    cutDate: daysFromNow(10),
    dueDate: daysFromNow(21),
    minPayment: 1800,
  },
  {
    id: 'debt-msi-tv',
    name: 'Pantalla Samsung 55"',
    type: 'Meses sin intereses',
    kind: 'msi',
    installments: 12,
    installmentsPaid: 3,
    interestFree: true,
    categoryId: 'compras',
    accountId: 'acc-bbva',
    totalAmount: 12000,
    remainingBalance: 9000,
    interestRate: 0,
    cutDate: daysFromNow(-5),
    dueDate: daysFromNow(9),
    minPayment: 1000,
  },
]

// ---------------------------------------------------------------------------
// Budgets (monthly limit per category)
// ---------------------------------------------------------------------------

export const BUDGETS = [
  { categoryId: 'comida', limit: 4500 },
  { categoryId: 'transporte', limit: 1500 },
  { categoryId: 'renta', limit: 7000 },
  { categoryId: 'entretenimiento', limit: 1000 },
  { categoryId: 'salud', limit: 1200 },
  { categoryId: 'compras', limit: 2000 },
  { categoryId: 'servicios', limit: 1800 },
  { categoryId: 'otros', limit: 800 },
]

// ---------------------------------------------------------------------------
// Recurring monthly bills — configured once, but payment each month must be
// confirmed manually (never marked paid automatically).
// ---------------------------------------------------------------------------

export const RECURRING_BILLS = [
  { id: 'rec-renta', name: 'Renta departamento', categoryId: 'renta', estimatedAmount: 7000, dueDay: 1, accountId: 'acc-nu' },
  { id: 'rec-internet', name: 'Internet', categoryId: 'servicios', estimatedAmount: 599, dueDay: 8, accountId: 'acc-bbva' },
  { id: 'rec-netflix', name: 'Netflix', categoryId: 'entretenimiento', estimatedAmount: 219, dueDay: 12, accountId: 'acc-santander' },
  { id: 'rec-celular', name: 'Celular (ambos)', categoryId: 'servicios', estimatedAmount: 458, dueDay: 20, accountId: 'acc-bbva' },
]

// No confirmations seeded on purpose — this month starts "pendiente" for
// every bill so the confirm-payment flow is visible right away in the demo.
export const RECURRING_CONFIRMATIONS = []

// ---------------------------------------------------------------------------
// Static informational notifications (merged with live alerts in FinanceContext)
// ---------------------------------------------------------------------------

export const STATIC_NOTIFICATIONS = [
  {
    id: 'note-welcome',
    kind: 'info',
    title: 'Bienvenido a Mi Control Financiero',
    message: 'Configura tus cuentas y presupuestos para empezar a llevar el control.',
    date: daysFromNow(-28),
    read: true,
  },
  {
    id: 'note-summary',
    kind: 'summary',
    title: 'Resumen del mes anterior disponible',
    message: 'Revisa cómo se distribuyeron tus gastos el mes pasado en la sección de Presupuestos.',
    date: daysFromNow(-3),
    read: true,
  },
]

export const USER = {
  name: 'José Manuel Ramírez',
  email: 'jmrm.2929@gmail.com',
  photoURL: null,
}
