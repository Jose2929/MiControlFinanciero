import { describe, it, expect } from 'vitest'
import { cycleFromKey, getCycleForDate, shiftCycle } from './budget'
import {
  computeEnvelopes,
  cycleRange,
  cyclesBetween,
  findUnclassified,
  isEnvelopeLine,
  movementAmount,
  reconciliationEntry,
} from './budgetBalances'
import { normalizePlan } from './budgetPlan'
import { line } from './budgetFixtures'
import { toDateInputValue } from './format'

// Cifras FICTICIAS. Hoy "simulado" = 19 de noviembre de 2026.
const TODAY = new Date(2026, 10, 19)
const day = (y, m, d) => new Date(y, m - 1, d)

function makePlan({ settings, lines, accountMedios } = {}) {
  return normalizePlan({
    settings: { cycleStartDay: 1, startCycle: '2026-10', ...settings },
    accountMedios: accountMedios ?? {
      'acc-deb': 'debito',
      'acc-cash': 'efectivo',
      'acc-t2': 'tdc2',
      'acc-tdc': 'tdc',
    },
    lines: lines ?? [
      line('d-mand', 'debito', 'sobre', 1500, { name: 'Mandado' }),
      line('d-ocio', 'debito', 'sobre', 600, { name: 'Entretenimiento' }),
      line('c-croq', 'efectivo', 'sobre', 300, { name: 'Croquetas' }),
      line('fondo', 'tdc2', 'fondo', 500, { payFrequency: null, name: 'Fondo' }),
      line('bol-anual', 'tdc2', 'bolsillo', 400, { payFrequency: 'anual', name: 'Bolsillo' }),
      line('cargo', 'tdc', 'cargo', 100),
      line('ahorro', 'ahorro', 'ahorro', 900),
    ],
  })
}

let seq = 0
const tx = (date, envelopeId, amount, extra = {}) => ({
  id: `t${(seq += 1)}`,
  type: 'expense',
  amount,
  envelopeId,
  accountId: 'acc-deb',
  categoryId: 'comida',
  date,
  ...extra,
})

const nov = () => getCycleForDate(TODAY, 1)
const oct = () => shiftCycle(nov(), -1)
const run = (plan, transactions, cycle = nov()) => computeEnvelopes({ plan, transactions, cycle, today: TODAY })
const item = (result, id) => result.items.find((i) => i.line.id === id)

describe('cycleFromKey / cyclesBetween / cycleRange', () => {
  it('construye el ciclo de una clave AAAA-MM', () => {
    const c = cycleFromKey('2026-11', 1)
    expect([toDateInputValue(c.start), toDateInputValue(c.end), c.days]).toEqual(['2026-11-01', '2026-11-30', 30])
    const c15 = cycleFromKey('2026-11', 15)
    expect([toDateInputValue(c15.start), toDateInputValue(c15.end)]).toEqual(['2026-11-15', '2026-12-14'])
  })

  it('rechaza claves inválidas', () => {
    for (const key of [null, undefined, '', '2026-13', '2026-00', '26-11', '2026/11', 5]) {
      expect(cycleFromKey(key)).toBeNull()
    }
  })

  it('cyclesBetween incluye ambos extremos, incluso cruzando de año', () => {
    const cycles = cyclesBetween(cycleFromKey('2026-11', 1), cycleFromKey('2027-02', 1))
    expect(cycles.map((c) => c.key)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(cyclesBetween(cycleFromKey('2026-11', 1), cycleFromKey('2026-11', 1))).toHaveLength(1)
    expect(cyclesBetween(cycleFromKey('2026-11', 1), cycleFromKey('2026-10', 1))).toEqual([])
  })

  it('cycleRange va del ciclo de arranque al de hoy', () => {
    const r = cycleRange(makePlan(), TODAY)
    expect([r.first.key, r.current.key, r.last.key]).toEqual(['2026-10', '2026-11', '2026-11'])
  })

  it('si el arranque es futuro, el rango es solo ese ciclo', () => {
    const r = cycleRange(makePlan({ settings: { startCycle: '2026-12' } }), TODAY)
    expect([r.first.key, r.last.key]).toEqual(['2026-12', '2026-12'])
  })

  it('sin ciclo de arranque no hay rango', () => {
    expect(cycleRange(makePlan({ settings: { startCycle: null } }), TODAY)).toBeNull()
  })
})

describe('computeEnvelopes — qué líneas entran', () => {
  it('sin ciclo de arranque, o con un ciclo anterior a él, no calcula', () => {
    expect(run(makePlan({ settings: { startCycle: null } }), [])).toBeNull()
    expect(run(makePlan({ settings: { startCycle: '2026-11' } }), [], oct())).toBeNull()
  })

  it('solo sobres, fondo y bolsillos — no cargos de la TDC ni ahorros', () => {
    const r = run(makePlan(), [])
    expect(r.items.map((i) => i.line.id)).toEqual(['d-mand', 'd-ocio', 'c-croq', 'fondo', 'bol-anual'])
    expect(isEnvelopeLine(line('x', 'tdc', 'cargo', 1))).toBe(false)
    expect(isEnvelopeLine({ kind: 'ahorro' })).toBe(false)
  })
})

describe('computeEnvelopes — arrastre ("todo acumula", arranque en $0)', () => {
  const txs = [
    tx(day(2026, 10, 5), 'd-mand', 1000),
    tx(day(2026, 10, 20), 'd-mand', 200),
    tx(day(2026, 11, 3), 'd-mand', 300),
  ]

  it('el primer ciclo arranca en cero', () => {
    const r = item(run(makePlan(), txs, oct()), 'd-mand')
    expect(r).toMatchObject({ opening: 0, assigned: 1500, spent: 1200, balance: 300 })
  })

  it('lo que sobra de un ciclo pasa al siguiente', () => {
    const r = item(run(makePlan(), txs), 'd-mand')
    expect(r).toMatchObject({ opening: 300, assigned: 1500, spent: 300, balance: 1500 })
  })

  it('un ciclo futuro sigue acumulando', () => {
    const dec = shiftCycle(nov(), 1)
    const r = item(run(makePlan(), txs, dec), 'd-mand')
    expect(r).toMatchObject({ opening: 1500, assigned: 1500, spent: 0, balance: 3000 })
  })

  it('un sobre sin gastos acumula todo lo asignado', () => {
    expect(item(run(makePlan(), []), 'd-ocio')).toMatchObject({ opening: 600, assigned: 600, spent: 0, balance: 1200 })
  })

  it('sobregirarse en un ciclo deja arrastre negativo en el siguiente', () => {
    const r = item(run(makePlan(), [tx(day(2026, 10, 9), 'd-ocio', 900)]), 'd-ocio')
    expect(r).toMatchObject({ opening: -300, balance: 300 }) // −300 + 600
  })

  it('cada bolsillo acumula lo apartado cada mes, menos lo que se saca de él', () => {
    const withdrawal = tx(day(2026, 10, 12), 'bol-anual', 150, { accountId: 'acc-t2' })
    const r = item(run(makePlan(), [withdrawal]), 'bol-anual')
    expect(r).toMatchObject({ opening: 250, assigned: 400, spent: 0, balance: 650 })
  })
})

describe('computeEnvelopes — ritmo y aproximado por semana', () => {
  it('gasto esperado y diferencia contra lo gastado (día 19 de 30)', () => {
    const r = item(run(makePlan(), [tx(day(2026, 11, 3), 'd-mand', 300)]), 'd-mand')
    expect(r.expected).toBe(950) // 1500 × 19/30
    expect(r.paceDiff).toBe(-650)
    expect(r.status).toBe('ok')
  })

  it('aproximado por semana = disponible / semanas restantes (12 días)', () => {
    const r = item(run(makePlan(), [tx(day(2026, 11, 3), 'd-mand', 300)]), 'd-mand')
    // Octubre no tuvo gastos: arrastra los 1500 completos. 1500 + 1500 − 300.
    expect(r.balance).toBe(2700)
    expect(r.perWeek).toBe(1575) // 2700 / (12/7)
  })

  it('por encima del ritmo pero sin pasarse de lo disponible → aviso', () => {
    const r = item(run(makePlan(), [tx(day(2026, 11, 3), 'd-mand', 1000)]), 'd-mand')
    expect(r.spent).toBeGreaterThan(r.expected)
    expect(r.balance).toBeGreaterThan(0)
    expect(r.status).toBe('warning')
  })

  it('pasarse de lo disponible → peligro', () => {
    const r = item(run(makePlan(), [tx(day(2026, 11, 3), 'd-ocio', 2000)]), 'd-ocio')
    expect(r.balance).toBeLessThan(0)
    expect(r.status).toBe('danger')
  })

  it('en un ciclo ya cerrado el esperado es todo lo asignado y no hay aproximado semanal', () => {
    const r = run(makePlan(), [tx(day(2026, 10, 5), 'd-mand', 1000)], oct())
    expect(r.isPast).toBe(true)
    expect(item(r, 'd-mand')).toMatchObject({ expected: 1500, perWeek: 0 })
  })

  it('el ciclo actual lo marca como tal', () => {
    const r = run(makePlan(), [])
    expect(r.isCurrent).toBe(true)
    expect(r.progress).toMatchObject({ status: 'current', dayNumber: 19, daysLeft: 12 })
  })
})

describe('computeEnvelopes — qué operaciones cuentan', () => {
  const base = (extra) => item(run(makePlan(), [tx(day(2026, 11, 5), 'd-mand', 100, extra)]), 'd-mand').spent

  it('un gasto con sobre cuenta', () => {
    expect(base({})).toBe(100)
  })

  it('un pago de tarjeta no cuenta aunque traiga sobre', () => {
    expect(base({ counterAccountId: 'acc-tdc' })).toBe(0)
  })

  it('un gasto convertido a MSI no cuenta', () => {
    expect(base({ convertedToMsi: true })).toBe(0)
  })

  it('ingresos, pagos de deuda y ajustes no cuentan', () => {
    for (const type of ['income', 'debt_payment', 'adjustment', 'saving_movement']) {
      expect(base({ type })).toBe(0)
    }
  })

  it('un gasto sin sobre, o con un sobre que ya no existe, no suma a ninguno', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 5), undefined, 100), tx(day(2026, 11, 5), 'borrado', 100)])
    expect(r.spendTotals.spent).toBe(0)
  })

  it('un gasto anterior al ciclo de arranque se ignora', () => {
    const r = run(makePlan(), [tx(day(2026, 9, 28), 'd-mand', 500)])
    expect(item(r, 'd-mand')).toMatchObject({ opening: 1500, spent: 0 })
  })

  it('un gasto de un ciclo posterior al elegido no se mezcla', () => {
    const r = run(makePlan(), [tx(day(2026, 12, 2), 'd-mand', 500)])
    expect(item(r, 'd-mand').spent).toBe(0)
  })

  it('suma centavos sin errores de coma flotante', () => {
    const txs = [33.33, 33.33, 33.33].map((a) => tx(day(2026, 11, 5), 'd-ocio', a))
    expect(item(run(makePlan(), txs), 'd-ocio').spent).toBe(99.99)
  })
})

describe('computeEnvelopes — líneas agregadas después (since)', () => {
  const lines = [
    line('vieja', 'debito', 'sobre', 1000),
    line('nueva', 'debito', 'sobre', 1000, { since: '2026-11' }),
    line('anterior', 'debito', 'sobre', 1000, { since: '2026-01' }),
  ]

  it('una línea nueva no acumula hacia atrás', () => {
    const r = run(makePlan({ lines }), [])
    expect(item(r, 'vieja')).toMatchObject({ opening: 1000, balance: 2000 })
    expect(item(r, 'nueva')).toMatchObject({ opening: 0, assigned: 1000, balance: 1000 })
  })

  it('un since anterior al arranque se ignora', () => {
    expect(item(run(makePlan({ lines }), []), 'anterior').balance).toBe(2000)
  })

  it('en el ciclo previo a su since, no tiene asignación', () => {
    expect(item(run(makePlan({ lines }), [], oct()), 'nueva')).toMatchObject({ assigned: 0, balance: 0 })
  })
})

describe('computeEnvelopes — totales y ciclos que no empiezan el día 1', () => {
  it('los totales diarios suman sobres y fondo, pero no los bolsillos', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 3), 'd-mand', 300), tx(day(2026, 11, 4), 'bol-anual', 50, { accountId: 'acc-t2' })])
    // asignado noviembre: 1500 + 600 + 300 + 500
    expect(r.spendTotals).toMatchObject({ assigned: 2900, spent: 300 })
    // arrastre de octubre (sobres y fondo, sin gastos en octubre): 1500 + 600 + 300 + 500
    expect(r.spendTotals.opening).toBe(2900)
    expect(r.spendTotals.balance).toBe(2900 + 2900 - 300)
  })

  it('con ciclo del 15 al 14, cada gasto cae en el ciclo que le toca', () => {
    const plan = makePlan({ settings: { cycleStartDay: 15, startCycle: '2026-10' } })
    const firstCycle = cycleFromKey('2026-10', 15) // 15 oct – 14 nov
    const txs = [tx(day(2026, 11, 10), 'd-mand', 100), tx(day(2026, 11, 15), 'd-mand', 40)]
    const r1 = computeEnvelopes({ plan, transactions: txs, cycle: firstCycle, today: TODAY })
    expect(item(r1, 'd-mand').spent).toBe(100)
    const r2 = computeEnvelopes({ plan, transactions: txs, cycle: shiftCycle(firstCycle, 1), today: TODAY })
    expect(item(r2, 'd-mand')).toMatchObject({ spent: 40, opening: 1400 })
  })
})

describe('findUnclassified', () => {
  const plan = makePlan()
  const labelOf = (id) => ({ comida: 'Comida', entretenimiento: 'Entretenimiento' })[id] || ''
  const list = (transactions, cycle = nov()) => findUnclassified({ plan, transactions, cycle, categoryLabelOf: labelOf })
  const ids = (items) => items.map((i) => i.transaction.id)

  it('lista los gastos de cuentas de gasto diario que no tienen sobre', () => {
    const a = tx(day(2026, 11, 5), undefined, 10)
    const b = tx(day(2026, 11, 6), undefined, 20, { accountId: 'acc-cash' })
    const c = tx(day(2026, 11, 7), undefined, 30, { accountId: 'acc-t2' })
    expect(ids(list([a, b, c])).sort()).toEqual([a.id, b.id, c.id].sort())
  })

  it('no pide los que ya tienen un sobre que existe', () => {
    expect(list([tx(day(2026, 11, 5), 'd-mand', 10)])).toEqual([])
  })

  it('sí pide los que apuntan a un sobre que ya no existe', () => {
    const t = tx(day(2026, 11, 5), 'borrado', 10)
    expect(ids(list([t]))).toEqual([t.id])
  })

  it('no pide cargos de la TDC, cuentas fuera del presupuesto ni de ahorro', () => {
    const txs = [
      tx(day(2026, 11, 5), undefined, 10, { accountId: 'acc-tdc' }),
      tx(day(2026, 11, 5), undefined, 10, { accountId: 'acc-otra' }),
    ]
    expect(list(txs)).toEqual([])
  })

  it('no pide pagos de tarjeta, gastos a MSI, ingresos ni otros tipos', () => {
    const txs = [
      tx(day(2026, 11, 5), undefined, 10, { counterAccountId: 'acc-tdc' }),
      tx(day(2026, 11, 5), undefined, 10, { convertedToMsi: true }),
      tx(day(2026, 11, 5), undefined, 10, { type: 'income' }),
      tx(day(2026, 11, 5), undefined, 10, { type: 'debt_payment' }),
    ]
    expect(list(txs)).toEqual([])
  })

  it('solo mira el ciclo elegido', () => {
    const t = tx(day(2026, 10, 5), undefined, 10)
    expect(list([t])).toEqual([])
    expect(ids(list([t], oct()))).toEqual([t.id])
  })

  it('ordena del más reciente al más antiguo', () => {
    const old = tx(day(2026, 11, 2), undefined, 10)
    const recent = tx(day(2026, 11, 12), undefined, 10)
    expect(ids(list([old, recent]))).toEqual([recent.id, old.id])
  })

  it('ofrece los sobres del medio de cada cuenta', () => {
    const [d] = list([tx(day(2026, 11, 5), undefined, 10)])
    expect(d.options.map((l) => l.id)).toEqual(['d-mand', 'd-ocio'])
    const [e] = list([tx(day(2026, 11, 5), undefined, 10, { accountId: 'acc-cash' })])
    expect(e.options.map((l) => l.id)).toEqual(['c-croq'])
  })

  it('trae la sugerencia (historial o nombre) cuando la hay', () => {
    const history = [
      tx(day(2026, 11, 1), 'd-mand', 5, { categoryId: 'comida' }),
      tx(day(2026, 11, 8), undefined, 10, { categoryId: 'comida' }),
    ]
    const [byHistory] = list(history)
    expect(byHistory.suggestion).toEqual({ lineId: 'd-mand', reason: 'history' })

    const [byName] = list([tx(day(2026, 11, 8), undefined, 10, { categoryId: 'entretenimiento' })])
    expect(byName.suggestion).toEqual({ lineId: 'd-ocio', reason: 'name' })

    const [none] = list([tx(day(2026, 11, 8), undefined, 10, { categoryId: 'otros' })])
    expect(none.suggestion).toBeNull()
  })
})

describe('movementAmount — agregar o sacar dinero de un sobre', () => {
  it('agregar suma y sacar resta', () => {
    expect(movementAmount('in', '500')).toBe(500)
    expect(movementAmount('out', '500')).toBe(-500)
    expect(movementAmount('out', 120.5)).toBe(-120.5)
  })

  it('redondea a centavos', () => {
    expect(movementAmount('in', '10.005')).toBe(10.01)
    expect(movementAmount('out', '0.1')).toBe(-0.1)
  })

  it('lo que no es un monto válido da null', () => {
    for (const raw of ['', '   ', null, undefined, 'abc', '0', 0, '-5', -5, '0.001', NaN, Infinity]) {
      expect(movementAmount('in', raw)).toBeNull()
      expect(movementAmount('out', raw)).toBeNull()
    }
  })
})

describe('reconciliationEntry — qué se guarda al ajustar un sobre', () => {
  const envelope = { id: 'd-mand', name: 'Mandado' }

  it('un gasto olvidado va con la fecha del ciclo que se corrige (no la de hoy)', () => {
    const { type, input } = reconciliationEntry({
      mode: 'expense',
      difference: -1000,
      envelope,
      accountId: 'acc-deb',
      note: '',
      date: '2026-10-31',
    })
    expect(type).toBe('expense')
    expect(input).toEqual({
      amount: 1000,
      categoryId: 'otros',
      accountId: 'acc-deb',
      envelopeId: 'd-mand',
      note: 'Gasto sin registrar (Mandado)',
      date: '2026-10-31',
    })
  })

  it('una corrección conserva el signo de la diferencia y su fecha', () => {
    const missing = reconciliationEntry({ mode: 'adjust', difference: -650, envelope, note: '  ', date: '2026-10-31' })
    expect(missing).toEqual({
      type: 'adjustment',
      input: { envelopeId: 'd-mand', amount: -650, date: '2026-10-31', note: 'Conteo del sobre' },
    })
    const extra = reconciliationEntry({ mode: 'adjust', difference: 280, envelope, note: 'Me sobró', date: '2026-12-01' })
    expect(extra.input).toMatchObject({ amount: 280, date: '2026-12-01', note: 'Me sobró' })
  })

  it('la nota que escribe la persona manda sobre la de por defecto', () => {
    const { input } = reconciliationEntry({
      mode: 'expense',
      difference: -90,
      envelope,
      accountId: 'a',
      note: ' Tacos ',
      date: '2026-11-19',
    })
    expect(input.note).toBe('Tacos')
  })
})
