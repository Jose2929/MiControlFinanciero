import { describe, it, expect } from 'vitest'
import { getCycleForDate, shiftCycle } from './budget'
import {
  CATCH_ALL,
  isEnvelopeLine,
  makeEnvelopeResolver,
  ruleEnvelopeFor,
  suggestEnvelope,
} from './budgetEnvelopes'
import { computeEnvelopes, findUnclassified, reconcileEnvelope } from './budgetBalances'
import {
  isValidDateKey,
  normalizeAdjustment,
  normalizeCategoryEnvelopes,
  normalizePlan,
  planToExport,
  planToTree,
  validatePlanInput,
} from './budgetPlan'
import { line } from './budgetFixtures'

// Cifras FICTICIAS. Hoy "simulado" = 19 de noviembre de 2026.
const TODAY = new Date(2026, 10, 19)
const day = (y, m, d) => new Date(y, m - 1, d)

function makePlan(extra = {}) {
  return normalizePlan({
    settings: { cycleStartDay: 1, startCycle: '2026-10' },
    accountMedios: { 'acc-deb': 'debito', 'acc-cash': 'efectivo', 'acc-t2': 'tdc2', 'acc-tdc': 'tdc', 'acc-save': 'ahorro' },
    categoryEnvelopes: {
      debito: { comida: 'd-mand', entretenimiento: 'd-ocio' },
      efectivo: { comida: 'c-mand' },
      tdc2: { [CATCH_ALL]: 'fondo' },
    },
    lines: [
      line('d-mand', 'debito', 'sobre', 1500, { name: 'Mandado' }),
      line('d-ocio', 'debito', 'sobre', 600, { name: 'Entretenimiento' }),
      line('c-mand', 'efectivo', 'sobre', 300, { name: 'Mandado' }),
      line('fondo', 'tdc2', 'fondo', 500, { payFrequency: null, name: 'Fondo' }),
      line('bol', 'tdc2', 'bolsillo', 400, { payFrequency: 'anual', name: 'Bolsillo' }),
      line('cargo', 'tdc', 'cargo', 100),
    ],
    ...extra,
  })
}

let seq = 0
const tx = (date, amount, extra = {}) => ({
  id: `t${(seq += 1)}`,
  type: 'expense',
  amount,
  accountId: 'acc-deb',
  categoryId: 'comida',
  date,
  ...extra,
})

const nov = () => getCycleForDate(TODAY, 1)
const oct = () => shiftCycle(nov(), -1)
const run = (plan, transactions, cycle = nov()) => computeEnvelopes({ plan, transactions, cycle, today: TODAY })
const item = (result, id) => result.items.find((i) => i.line.id === id)

describe('ruleEnvelopeFor — sobre ligado a una categoría', () => {
  const plan = makePlan()

  it('devuelve el sobre ligado a la categoría en ese medio', () => {
    expect(ruleEnvelopeFor(plan, 'debito', 'comida')).toBe('d-mand')
    expect(ruleEnvelopeFor(plan, 'debito', 'entretenimiento')).toBe('d-ocio')
    expect(ruleEnvelopeFor(plan, 'efectivo', 'comida')).toBe('c-mand')
  })

  it('el mismo nombre de categoría en otro medio va a su propio sobre', () => {
    expect(ruleEnvelopeFor(plan, 'debito', 'comida')).not.toBe(ruleEnvelopeFor(plan, 'efectivo', 'comida'))
  })

  it('sin liga propia usa "todo lo demás" del medio, si lo hay', () => {
    expect(ruleEnvelopeFor(plan, 'tdc2', 'transporte')).toBe('fondo')
    expect(ruleEnvelopeFor(plan, 'debito', 'transporte')).toBeNull()
  })

  it('la liga propia gana sobre "todo lo demás"', () => {
    const p = makePlan({ categoryEnvelopes: { debito: { comida: 'd-ocio', [CATCH_ALL]: 'd-mand' } } })
    expect(ruleEnvelopeFor(p, 'debito', 'comida')).toBe('d-ocio')
    expect(ruleEnvelopeFor(p, 'debito', 'salud')).toBe('d-mand')
  })

  it('ignora una liga a un sobre que ya no existe y cae a "todo lo demás"', () => {
    const p = makePlan({ categoryEnvelopes: { debito: { comida: 'borrado', [CATCH_ALL]: 'd-ocio' } } })
    expect(ruleEnvelopeFor(p, 'debito', 'comida')).toBe('d-ocio')
    const sinResto = makePlan({ categoryEnvelopes: { debito: { comida: 'borrado' } } })
    expect(ruleEnvelopeFor(sinResto, 'debito', 'comida')).toBeNull()
  })

  it('ignora una liga a un sobre de otro medio', () => {
    const p = makePlan({ categoryEnvelopes: { debito: { comida: 'c-mand' } } })
    expect(ruleEnvelopeFor(p, 'debito', 'comida')).toBeNull()
  })

  it('no liga a cargos de la TDC ni a ahorros (no son sobres)', () => {
    const p = makePlan({ categoryEnvelopes: { tdc: { comida: 'cargo' } } })
    expect(ruleEnvelopeFor(p, 'tdc', 'comida')).toBeNull()
    expect(isEnvelopeLine(line('x', 'tdc', 'cargo', 1))).toBe(false)
  })

  it('sin ligas o sin plan, null', () => {
    expect(ruleEnvelopeFor(makePlan({ categoryEnvelopes: {} }), 'debito', 'comida')).toBeNull()
    expect(ruleEnvelopeFor(null, 'debito', 'comida')).toBeNull()
  })
})

describe('makeEnvelopeResolver — a qué sobre pertenece cada gasto', () => {
  const resolve = makeEnvelopeResolver(makePlan())

  it('un gasto sin sobre elegido resta del sobre ligado a su categoría', () => {
    expect(resolve(tx(day(2026, 11, 3), 10))).toBe('d-mand')
    expect(resolve(tx(day(2026, 11, 3), 10, { categoryId: 'entretenimiento' }))).toBe('d-ocio')
  })

  it('el sobre elegido a mano gana sobre la regla de la categoría', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { envelopeId: 'd-ocio' }))).toBe('d-ocio')
  })

  it('un sobre elegido que ya no existe cae a la regla', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { envelopeId: 'borrado' }))).toBe('d-mand')
  })

  it('"todo lo demás" recoge las categorías sin liga propia', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { accountId: 'acc-t2', categoryId: 'transporte' }))).toBe('fondo')
  })

  it('sin liga y sin "todo lo demás", el gasto queda sin sobre', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { categoryId: 'transporte' }))).toBeNull()
  })

  it('una cuenta fuera del presupuesto no cuenta, salvo con sobre elegido a mano', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { accountId: 'otra' }))).toBeNull()
    expect(resolve(tx(day(2026, 11, 3), 10, { accountId: 'otra', envelopeId: 'd-mand' }))).toBe('d-mand')
  })

  it('de la cuenta de ahorro o de la TDC no se descuenta por regla', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { accountId: 'acc-save' }))).toBeNull()
    expect(resolve(tx(day(2026, 11, 3), 10, { accountId: 'acc-tdc' }))).toBeNull()
  })

  it('no cuentan pagos de tarjeta, gastos a MSI, ingresos ni otros tipos', () => {
    expect(resolve(tx(day(2026, 11, 3), 10, { counterAccountId: 'acc-tdc' }))).toBeNull()
    expect(resolve(tx(day(2026, 11, 3), 10, { convertedToMsi: true }))).toBeNull()
    for (const type of ['income', 'debt_payment', 'saving_movement', 'adjustment']) {
      expect(resolve(tx(day(2026, 11, 3), 10, { type }))).toBeNull()
    }
    expect(resolve(null)).toBeNull()
  })
})

describe('suggestEnvelope — la liga va primero', () => {
  const base = { accountId: 'acc-deb', categoryId: 'comida', categoryLabel: 'Comida' }

  it('sugiere el sobre ligado, con motivo "rule"', () => {
    expect(suggestEnvelope({ plan: makePlan(), ...base })).toEqual({ lineId: 'd-mand', reason: 'rule' })
  })

  it('la liga gana sobre el historial y sobre el nombre', () => {
    const history = [tx(day(2026, 11, 1), 5, { categoryId: 'comida', envelopeId: 'd-ocio' })]
    expect(suggestEnvelope({ plan: makePlan(), ...base, transactions: history }).reason).toBe('rule')
    const p = makePlan({ categoryEnvelopes: { debito: { entretenimiento: 'd-mand' } } })
    const r = suggestEnvelope({ plan: p, ...base, categoryId: 'entretenimiento', categoryLabel: 'Entretenimiento' })
    expect(r).toEqual({ lineId: 'd-mand', reason: 'rule' })
  })

  it('sin liga, vuelve al historial o al nombre', () => {
    const p = makePlan({ categoryEnvelopes: {} })
    expect(suggestEnvelope({ plan: p, ...base, categoryId: 'x', categoryLabel: 'Entretenimiento' })).toEqual({
      lineId: 'd-ocio',
      reason: 'name',
    })
  })
})

describe('computeEnvelopes con ligas por categoría', () => {
  it('un gasto sin sobre elegido ya resta de su sobre (sin clasificarlo)', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 3), 300)])
    expect(item(r, 'd-mand')).toMatchObject({ spent: 300, opening: 1500, balance: 2700 })
  })

  it('lo elegido a mano manda sobre la regla', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 3), 300, { envelopeId: 'd-ocio' })])
    expect(item(r, 'd-mand').spent).toBe(0)
    expect(item(r, 'd-ocio').spent).toBe(300)
  })

  it('"todo lo demás" descuenta del fondo general', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 4), 80, { accountId: 'acc-t2', categoryId: 'otros' })])
    expect(item(r, 'fondo').spent).toBe(80)
  })

  it('un pago de tarjeta no resta aunque su categoría esté ligada', () => {
    const r = run(makePlan(), [tx(day(2026, 11, 3), 5000, { counterAccountId: 'acc-tdc' })])
    expect(r.spendTotals.spent).toBe(0)
  })

  it('cambiar la liga cambia a qué sobre cuentan los gastos que no traen sobre elegido', () => {
    const txs = [tx(day(2026, 11, 3), 300)]
    const antes = run(makePlan(), txs)
    const despues = run(makePlan({ categoryEnvelopes: { debito: { comida: 'd-ocio' } } }), txs)
    expect(item(antes, 'd-mand').spent).toBe(300)
    expect(item(despues, 'd-mand').spent).toBe(0)
    expect(item(despues, 'd-ocio').spent).toBe(300)
  })

  it('los gastos de antes del ciclo de arranque siguen ignorándose', () => {
    expect(run(makePlan(), [tx(day(2026, 9, 20), 999)]).spendTotals.spent).toBe(0)
  })
})

describe('findUnclassified con ligas', () => {
  const list = (plan, transactions) => findUnclassified({ plan, transactions, cycle: nov() })

  it('no pide los gastos que ya tienen sobre por la regla de su categoría', () => {
    expect(list(makePlan(), [tx(day(2026, 11, 3), 10)])).toEqual([])
  })

  it('sí pide los de categorías sin liga ni "todo lo demás"', () => {
    const pending = tx(day(2026, 11, 3), 10, { categoryId: 'transporte' })
    expect(list(makePlan(), [pending]).map((i) => i.transaction.id)).toEqual([pending.id])
  })

  it('con "todo lo demás" ya nada queda sin sobre en ese medio', () => {
    const p = makePlan({ categoryEnvelopes: { debito: { [CATCH_ALL]: 'd-mand' } } })
    expect(list(p, [tx(day(2026, 11, 3), 10, { categoryId: 'transporte' })])).toEqual([])
  })
})

describe('ajustes por conteo físico', () => {
  const adj = (envelopeId, amount, date, extra = {}) => ({
    id: `a${(seq += 1)}`,
    envelopeId,
    amount,
    date,
    note: 'Conteo',
    createdBy: 'u1',
    ...extra,
  })

  it('un ajuste negativo baja el saldo y uno positivo lo sube', () => {
    const down = run(makePlan({ adjustments: [adj('d-mand', -300, '2026-11-10')] }), [])
    expect(item(down, 'd-mand')).toMatchObject({ adjusted: -300, balance: 2700 }) // 1500 + 1500 − 300
    const up = run(makePlan({ adjustments: [adj('d-mand', 120, '2026-11-10')] }), [])
    expect(item(up, 'd-mand')).toMatchObject({ adjusted: 120, balance: 3120 })
  })

  it('el ajuste de un ciclo pasa al siguiente como parte del arrastre', () => {
    const p = makePlan({ adjustments: [adj('d-mand', -400, '2026-10-15')] })
    expect(item(run(p, [], oct()), 'd-mand')).toMatchObject({ adjusted: -400, balance: 1100 })
    expect(item(run(p, []), 'd-mand')).toMatchObject({ opening: 1100, adjusted: 0, balance: 2600 })
  })

  it('suma varios ajustes y no mezcla sobres', () => {
    const p = makePlan({
      adjustments: [adj('d-mand', -100, '2026-11-02'), adj('d-mand', -50, '2026-11-09'), adj('d-ocio', 25, '2026-11-09')],
    })
    const r = run(p, [])
    expect(item(r, 'd-mand').adjusted).toBe(-150)
    expect(item(r, 'd-ocio').adjusted).toBe(25)
    expect(r.spendTotals.adjusted).toBe(-125)
  })

  it('un ajuste anterior al ciclo de arranque, o de un sobre que ya no existe, se ignora', () => {
    const p = makePlan({ adjustments: [adj('d-mand', -999, '2026-09-30'), adj('borrado', -999, '2026-11-10')] })
    const r = run(p, [])
    expect(item(r, 'd-mand').adjusted).toBe(0)
    expect(r.spendTotals.adjusted).toBe(0)
  })

  it('el gasto esperado no cambia con un ajuste, pero el disponible y el aproximado por semana sí', () => {
    const base = item(run(makePlan(), []), 'd-mand')
    const ajustado = item(run(makePlan({ adjustments: [adj('d-mand', -1200, '2026-11-10')] }), []), 'd-mand')
    expect(ajustado.expected).toBe(base.expected)
    expect(ajustado.balance).toBe(base.balance - 1200)
    expect(ajustado.perWeek).toBeLessThan(base.perWeek)
  })

  it('contar el sobre deja su saldo exactamente en lo que hay', () => {
    const plan0 = makePlan()
    const before = item(run(plan0, [tx(day(2026, 11, 3), 300)]), 'd-mand')
    const rec = reconcileEnvelope({ balance: before.balance, actual: 1000 })
    const plan1 = makePlan({ adjustments: [adj('d-mand', rec.difference, '2026-11-19')] })
    expect(item(run(plan1, [tx(day(2026, 11, 3), 300)]), 'd-mand').balance).toBe(1000)
  })

  it('un gasto olvidado registrado después también baja el sobre (alternativa al ajuste)', () => {
    const before = item(run(makePlan(), []), 'd-mand').balance
    const forgotten = tx(day(2026, 11, 19), 320, { envelopeId: 'd-mand' })
    expect(item(run(makePlan(), [forgotten]), 'd-mand').balance).toBe(before - 320)
  })
})

describe('reconcileEnvelope', () => {
  it('detecta lo que falta, lo que sobra y cuando coincide', () => {
    expect(reconcileEnvelope({ balance: 1000, actual: 700 })).toEqual({ difference: -300, kind: 'missing' })
    expect(reconcileEnvelope({ balance: 1000, actual: 1250.5 })).toEqual({ difference: 250.5, kind: 'extra' })
    expect(reconcileEnvelope({ balance: 1000, actual: 1000 })).toEqual({ difference: 0, kind: 'none' })
  })

  it('acepta el monto como texto y redondea a centavos', () => {
    expect(reconcileEnvelope({ balance: 100.1, actual: '50.05' })).toEqual({ difference: -50.05, kind: 'missing' })
    expect(reconcileEnvelope({ balance: 0.3, actual: 0.1 + 0.2 }).kind).toBe('none')
  })

  it('un saldo negativo se corrige a lo que de verdad hay', () => {
    expect(reconcileEnvelope({ balance: -200, actual: 0 })).toEqual({ difference: 200, kind: 'extra' })
  })

  it('sin un monto válido no hay comparación', () => {
    for (const actual of ['', '   ', 'abc', null, undefined, NaN]) {
      expect(reconcileEnvelope({ balance: 100, actual })).toBeNull()
    }
  })
})

describe('normalizar ligas y ajustes (lo que devuelve RTDB)', () => {
  it('normalizeCategoryEnvelopes descarta medios inventados, valores vacíos y medios sin ligas', () => {
    expect(
      normalizeCategoryEnvelopes({
        debito: { comida: 'a', '*': 'b', vacia: '', nula: null, num: 5 },
        banco: { comida: 'x' },
        efectivo: {},
        tdc2: 'texto',
      })
    ).toEqual({ debito: { comida: 'a', '*': 'b' } })
    expect(normalizeCategoryEnvelopes(null)).toEqual({})
    expect(normalizeCategoryEnvelopes([])).toEqual({})
  })

  it('isValidDateKey acepta solo fechas reales', () => {
    expect(isValidDateKey('2026-11-19')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true)
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-11-1', '19/11/2026', '', null, 20261119]) {
      expect(isValidDateKey(bad)).toBe(false)
    }
  })

  it('normalizeAdjustment valida sobre, monto y fecha', () => {
    const ok = { envelopeId: 'e', amount: -300.004, date: '2026-11-19', note: '  Conteo ', createdBy: 'u1' }
    expect(normalizeAdjustment(ok, 'k1')).toEqual({
      id: 'k1',
      envelopeId: 'e',
      amount: -300,
      date: '2026-11-19',
      note: 'Conteo',
      createdBy: 'u1',
    })
    expect(normalizeAdjustment({ ...ok, envelopeId: '' })).toBeNull()
    expect(normalizeAdjustment({ ...ok, amount: 0 })).toBeNull() // un ajuste de cero no ajusta nada
    expect(normalizeAdjustment({ ...ok, amount: 'x' })).toBeNull()
    expect(normalizeAdjustment({ ...ok, date: '2026-02-30' })).toBeNull()
    expect(normalizeAdjustment(null)).toBeNull()
  })

  it('el plan lee ligas y ajustes, y ordena los ajustes por fecha', () => {
    const plan = normalizePlan({
      categoryEnvelopes: { debito: { comida: 'a' } },
      adjustments: {
        z: { envelopeId: 'e', amount: 5, date: '2026-11-20' },
        a: { envelopeId: 'e', amount: -5, date: '2026-11-02' },
        mala: { envelopeId: 'e', amount: 0, date: '2026-11-02' },
      },
    })
    expect(plan.categoryEnvelopes).toEqual({ debito: { comida: 'a' } })
    expect(plan.adjustments.map((a) => a.id)).toEqual(['a', 'z'])
  })

  it('un plan nuevo empieza sin ligas ni ajustes', () => {
    const plan = normalizePlan(null)
    expect(plan.categoryEnvelopes).toEqual({})
    expect(plan.adjustments).toEqual([])
  })
})

describe('las ligas y los ajustes no viajan con el plan exportado/importado', () => {
  it('ni se guardan al importar (replacePlan) ni se exportan', () => {
    const plan = makePlan({ adjustments: [{ id: 'a1', envelopeId: 'd-mand', amount: -5, date: '2026-11-10' }] })
    expect(plan.categoryEnvelopes).not.toEqual({})
    for (const key of ['categoryEnvelopes', 'adjustments', 'accountMedios']) {
      expect(planToTree(plan)).not.toHaveProperty(key)
      expect(planToExport(plan)).not.toHaveProperty(key)
    }
  })

  it('un archivo que las trae no las importa al hogar', () => {
    const file = { ...planToExport(makePlan()), categoryEnvelopes: { debito: { comida: 'd-mand' } } }
    const result = validatePlanInput(file)
    expect(result.ok).toBe(true)
    expect(planToTree(result.plan)).not.toHaveProperty('categoryEnvelopes')
  })
})
