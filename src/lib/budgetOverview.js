// ---------------------------------------------------------------------------
// Resumen general del presupuesto — lógica pura (sin React ni Firebase).
//
// Junta en un solo lugar lo que el plan reparte cada mes (tarjeta, digital,
// efectivo, ahorro), qué hay dentro de cada cosa y, con los saldos de los
// sobres, lo que se tiene ahora.
//
// "Digital" = Débito + TDC2 (cuentas, no efectivo). "Sobres de gasto diario" =
// los sobres de Débito y de Efectivo (sin el fondo general ni los bolsillos).
// ---------------------------------------------------------------------------

import { checkBalance, sumLines, totalsByMedio } from './budget'

const round = (n) => Math.round(n * 100) / 100

const FREQUENCY_LABELS = { mensual: 'Mensual', semestral: 'Semestral', anual: 'Anual' }

// Cada bloque "qué hay dentro": a qué medio corresponde y cómo se llama la lista.
const SECTIONS = [
  { id: 'debito', medio: 'debito', title: 'Sobres de Débito', hint: 'Gasto diario, en la cuenta de débito', noun: ['sobre', 'sobres'] },
  { id: 'efectivo', medio: 'efectivo', title: 'Sobres de Efectivo', hint: 'Se retira de la cuenta de débito', noun: ['sobre', 'sobres'] },
  { id: 'tdc2', medio: 'tdc2', title: 'Fondo y bolsillos (TDC2)', hint: 'Lo que se aparta cada mes', noun: ['renglón', 'renglones'] },
  { id: 'tdc', medio: 'tdc', title: 'Tarjeta de crédito', hint: 'Cargos fijos; se paga completa', noun: ['cargo', 'cargos'] },
  { id: 'ahorro', medio: 'ahorro', title: 'Ahorro', hint: 'Ahorros programados', noun: ['ahorro', 'ahorros'] },
]

// Texto corto de un renglón: "Día 13", "Anual · se aparta al mes", "Válvula del plan".
function lineDetail(line) {
  const parts = []
  if (line.kind === 'bolsillo' && FREQUENCY_LABELS[line.payFrequency]) parts.push(`cobro ${FREQUENCY_LABELS[line.payFrequency].toLowerCase()}`)
  if (line.payDay != null) parts.push(`día ${line.payDay}`)
  if (line.isValve) parts.push('válvula del plan')
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Lo que el plan reparte cada mes.
 *
 * Los porcentajes son sobre el ingreso mensual; si el plan asigna más de lo que
 * entra, sobre lo asignado (así nunca pasan de 100%).
 *
 * @returns {{
 *   income: number, assigned: number, remaining: number, balanced: boolean, hasIncome: boolean,
 *   groups: Array<{ id, label, hint, amount, share, parts }>,
 *   spending: { amount: number, share: number },
 *   sections: Array<{ id, title, hint, total, share, count, noun, lines }>,
 * }}
 */
export function buildOverview(plan) {
  const totals = totalsByMedio(plan)
  const balance = checkBalance(plan)
  const income = balance.totalIncome
  const assigned = balance.totalAssigned
  const base = Math.max(income, assigned)
  const share = (amount) => (base > 0 ? (amount / base) * 100 : 0)

  const groups = [
    { id: 'tdc', label: 'Tarjeta de crédito', hint: 'Cargos fijos de la TDC', amount: totals.tdc, parts: [] },
    {
      id: 'digital',
      label: 'Digital',
      hint: 'Débito y TDC2',
      amount: round(totals.debito + totals.tdc2),
      parts: [
        { label: 'Débito', amount: totals.debito },
        { label: 'TDC2', amount: totals.tdc2 },
      ],
    },
    { id: 'efectivo', label: 'Efectivo', hint: 'Se retira del débito', amount: totals.efectivo, parts: [] },
    { id: 'ahorro', label: 'Ahorro', hint: 'Ahorros programados', amount: totals.ahorro, parts: [] },
  ].map((group) => ({ ...group, share: share(group.amount) }))

  const spendingAmount = sumLines(plan.lines, (l) => l.kind === 'sobre' && (l.medio === 'debito' || l.medio === 'efectivo'))

  const sections = SECTIONS.map((section) => {
    const lines = plan.lines.filter((l) => l.medio === section.medio)
    if (section.id === 'tdc') lines.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'es'))
    const total = totals[section.medio]
    return {
      id: section.id,
      title: section.title,
      hint: section.hint,
      noun: section.noun,
      total,
      share: share(total),
      count: lines.length,
      lines: lines.map((l) => ({ id: l.id, name: l.name, amount: l.amount, detail: lineDetail(l) })),
    }
  }).filter((section) => section.count > 0)

  return {
    income,
    assigned,
    remaining: balance.remaining,
    balanced: balance.balanced,
    hasIncome: plan.incomes.length > 0,
    groups,
    spending: { amount: spendingAmount, share: share(spendingAmount) },
    sections,
  }
}

/**
 * Lo que se tiene ahora, a partir de los sobres del ciclo (computeEnvelopes().items).
 * Digital = Débito + TDC2 (fondo general y bolsillos); efectivo = sobres de efectivo.
 */
export function summarizeAvailable(items) {
  const sum = (predicate) => round(items.filter(predicate).reduce((total, item) => total + item.balance, 0))
  const debito = sum((i) => i.line.medio === 'debito')
  const fondo = sum((i) => i.line.medio === 'tdc2' && i.line.kind === 'fondo')
  const bolsillos = sum((i) => i.line.medio === 'tdc2' && i.line.kind === 'bolsillo')
  const efectivo = sum((i) => i.line.medio === 'efectivo')
  const digital = round(debito + fondo + bolsillos)
  return { debito, fondo, bolsillos, digital, efectivo, total: round(digital + efectivo) }
}
