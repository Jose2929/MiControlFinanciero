import { describe, it, expect } from 'vitest'
import {
  countsTowardEnvelope,
  envelopeOptions,
  getAccountMedio,
  suggestAccountMedios,
  suggestEnvelope,
} from './budgetEnvelopes'
import { normalizeAccountMedios, normalizePlan } from './budgetPlan'
import { line } from './budgetFixtures'

// Plan ficticio: tres medios con sobres y una cuenta por medio.
function plan() {
  return normalizePlan({
    accountMedios: { 'acc-tdc': 'tdc', 'acc-deb': 'debito', 'acc-cash': 'efectivo', 'acc-save': 'ahorro' },
    lines: [
      line('cargo', 'tdc', 'cargo', 100),
      line('deb-comida', 'debito', 'sobre', 4000, { name: 'Mandado' }),
      line('deb-ocio', 'debito', 'sobre', 2000, { name: 'Entretenimiento' }),
      line('deb-gas', 'debito', 'sobre', 1000, { name: 'Gasolina' }),
      line('cash-comida', 'efectivo', 'sobre', 2800, { name: 'Mandado' }),
      line('cash-ocio', 'efectivo', 'sobre', 500, { name: 'Entretenimiento' }),
      line('ahorro', 'ahorro', 'ahorro', 300),
    ],
  })
}

const expense = (extra) => ({ type: 'expense', amount: 10, ...extra })

describe('getAccountMedio / normalizeAccountMedios', () => {
  it('devuelve el medio de la cuenta, o null si está fuera del presupuesto', () => {
    expect(getAccountMedio(plan(), 'acc-deb')).toBe('debito')
    expect(getAccountMedio(plan(), 'otra')).toBeNull()
    expect(getAccountMedio(null, 'acc-deb')).toBeNull()
  })

  it('al leer descarta medios inventados y formas raras', () => {
    expect(normalizeAccountMedios({ a: 'tdc', b: 'banco', c: 5, d: null })).toEqual({ a: 'tdc' })
    expect(normalizeAccountMedios(null)).toEqual({})
    expect(normalizeAccountMedios(['tdc'])).toEqual({})
  })
})

describe('envelopeOptions', () => {
  it('ofrece solo las líneas del medio de la cuenta, en el orden del plan', () => {
    expect(envelopeOptions(plan(), 'acc-deb').map((l) => l.id)).toEqual(['deb-comida', 'deb-ocio', 'deb-gas'])
    expect(envelopeOptions(plan(), 'acc-cash').map((l) => l.id)).toEqual(['cash-comida', 'cash-ocio'])
    expect(envelopeOptions(plan(), 'acc-tdc').map((l) => l.id)).toEqual(['cargo'])
  })

  it('una cuenta fuera del presupuesto no ofrece nada', () => {
    expect(envelopeOptions(plan(), 'otra')).toEqual([])
    expect(envelopeOptions(plan(), undefined)).toEqual([])
  })

  it('de una cuenta de ahorro no se gasta: no ofrece nada', () => {
    expect(envelopeOptions(plan(), 'acc-save')).toEqual([])
  })
})

describe('countsTowardEnvelope', () => {
  it('un gasto con sobre cuenta', () => {
    expect(countsTowardEnvelope(expense({ envelopeId: 'x' }))).toBe(true)
  })

  it('sin sobre no cuenta', () => {
    expect(countsTowardEnvelope(expense({}))).toBe(false)
    expect(countsTowardEnvelope(expense({ envelopeId: null }))).toBe(false)
    expect(countsTowardEnvelope(expense({ envelopeId: '' }))).toBe(false)
  })

  it('un pago de tarjeta no cuenta aunque traiga sobre', () => {
    expect(countsTowardEnvelope(expense({ envelopeId: 'x', counterAccountId: 'acc-tdc' }))).toBe(false)
  })

  it('un gasto convertido a MSI no cuenta (la deuda ya lo absorbió)', () => {
    expect(countsTowardEnvelope(expense({ envelopeId: 'x', convertedToMsi: true }))).toBe(false)
  })

  it('solo los gastos cuentan: ni ingresos, pagos de deuda, ahorro ni ajustes', () => {
    for (const type of ['income', 'debt_payment', 'saving_movement', 'adjustment']) {
      expect(countsTowardEnvelope({ type, amount: 1, envelopeId: 'x' })).toBe(false)
    }
  })

  it('tolera valores vacíos', () => {
    expect(countsTowardEnvelope(null)).toBe(false)
    expect(countsTowardEnvelope(undefined)).toBe(false)
  })
})

describe('suggestEnvelope', () => {
  const base = { plan: plan(), accountId: 'acc-deb', categoryId: 'comida', categoryLabel: 'Comida' }

  it('sin sobres para esa cuenta no sugiere nada', () => {
    expect(suggestEnvelope({ ...base, accountId: 'otra' })).toBeNull()
    expect(suggestEnvelope({ ...base, accountId: 'acc-save' })).toBeNull()
  })

  it('sin historial ni coincidencia de nombre no sugiere (no adivina)', () => {
    expect(suggestEnvelope(base)).toBeNull() // "Comida" no se llama como ningún sobre
  })

  it('sugiere por nombre, ignorando mayúsculas y acentos', () => {
    const r = suggestEnvelope({ ...base, categoryId: 'entretenimiento', categoryLabel: 'ENTRETENIMIENTO' })
    expect(r).toEqual({ lineId: 'deb-ocio', reason: 'name' })
    const sinAcento = suggestEnvelope({ ...base, categoryId: 'x', categoryLabel: 'entretenímiento' })
    expect(sinAcento).toEqual({ lineId: 'deb-ocio', reason: 'name' })
  })

  it('la coincidencia por nombre respeta el medio: efectivo no sugiere el sobre de débito', () => {
    const r = suggestEnvelope({ ...base, accountId: 'acc-cash', categoryLabel: 'Entretenimiento' })
    expect(r).toEqual({ lineId: 'cash-ocio', reason: 'name' })
  })

  it('el historial gana sobre el nombre y elige el sobre más usado', () => {
    const transactions = [
      expense({ categoryId: 'comida', envelopeId: 'deb-gas' }),
      expense({ categoryId: 'comida', envelopeId: 'deb-comida' }),
      expense({ categoryId: 'comida', envelopeId: 'deb-comida' }),
    ]
    expect(suggestEnvelope({ ...base, transactions })).toEqual({ lineId: 'deb-comida', reason: 'history' })
    const porNombre = suggestEnvelope({
      ...base,
      categoryId: 'entretenimiento',
      categoryLabel: 'Entretenimiento',
      transactions: [expense({ categoryId: 'entretenimiento', envelopeId: 'deb-gas' })],
    })
    expect(porNombre).toEqual({ lineId: 'deb-gas', reason: 'history' })
  })

  it('en un empate, queda el primero en el orden del plan', () => {
    const transactions = [
      expense({ categoryId: 'comida', envelopeId: 'deb-gas' }),
      expense({ categoryId: 'comida', envelopeId: 'deb-comida' }),
    ]
    expect(suggestEnvelope({ ...base, transactions }).lineId).toBe('deb-comida')
  })

  it('el historial ignora otras categorías, gastos sin sobre, pagos de tarjeta y MSI', () => {
    const transactions = [
      expense({ categoryId: 'transporte', envelopeId: 'deb-gas' }),
      expense({ categoryId: 'comida' }),
      expense({ categoryId: 'comida', envelopeId: 'deb-gas', counterAccountId: 'acc-tdc' }),
      expense({ categoryId: 'comida', envelopeId: 'deb-gas', convertedToMsi: true }),
      { type: 'income', categoryId: 'comida', envelopeId: 'deb-gas' },
    ]
    expect(suggestEnvelope({ ...base, transactions })).toBeNull()
  })

  it('el historial ignora sobres de otro medio', () => {
    const transactions = [expense({ categoryId: 'comida', envelopeId: 'cash-comida' })]
    expect(suggestEnvelope({ ...base, transactions })).toBeNull()
  })

  it('el historial ignora sobres que ya no existen en el plan', () => {
    const transactions = [expense({ categoryId: 'comida', envelopeId: 'borrado' })]
    expect(suggestEnvelope({ ...base, transactions })).toBeNull()
  })

  it('sin nombre de categoría no intenta coincidir por nombre', () => {
    expect(suggestEnvelope({ ...base, categoryLabel: '' })).toBeNull()
    expect(suggestEnvelope({ ...base, categoryLabel: undefined })).toBeNull()
  })
})

describe('suggestAccountMedios', () => {
  const acc = (id, name, type) => ({ id, name, type })

  it('propone cuando solo hay una candidata por medio', () => {
    const accounts = [
      acc('c', 'Tarjeta', 'credito'),
      acc('d', 'Débito', 'debito'),
      acc('e', 'Efectivo', 'efectivo'),
      acc('a', 'Ahorro', 'ahorro'),
    ]
    expect(suggestAccountMedios(accounts)).toEqual({ c: 'tdc', d: 'debito', e: 'efectivo', a: 'ahorro' })
  })

  it('con varias candidatas no propone nada (que elija la persona)', () => {
    const accounts = [
      acc('c1', 'Tarjeta 1', 'credito'),
      acc('c2', 'Tarjeta 2', 'credito'),
      acc('d1', 'Débito 1', 'debito'),
      acc('d2', 'Débito 2', 'debito'),
    ]
    expect(suggestAccountMedios(accounts)).toEqual({})
  })

  it('la cuenta con "tdc2" en el nombre es TDC2 y no cuenta como el débito', () => {
    const accounts = [acc('t2', 'Mi TDC2', 'debito'), acc('d', 'Débito diario', 'debito')]
    expect(suggestAccountMedios(accounts)).toEqual({ t2: 'tdc2', d: 'debito' })
  })

  it('no repite un medio que ya tiene cuenta ni toca cuentas ya asignadas', () => {
    const accounts = [acc('c', 'Tarjeta', 'credito'), acc('d', 'Débito', 'debito')]
    expect(suggestAccountMedios(accounts, { d: 'debito' })).toEqual({ c: 'tdc' })
    expect(suggestAccountMedios(accounts, { c: 'tdc', d: 'debito' })).toEqual({})
    // 'x' ya es TDC: la otra tarjeta no se propone como TDC también.
    expect(suggestAccountMedios([acc('x', 'A', 'credito'), acc('y', 'B', 'credito')], { x: 'tdc' })).toEqual({})
  })

  it('sin cuentas no propone nada', () => {
    expect(suggestAccountMedios([])).toEqual({})
  })
})
