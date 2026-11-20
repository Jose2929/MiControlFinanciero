import { describe, it, expect } from 'vitest'
import { buildOverview, summarizeAvailable } from './budgetOverview'
import { normalizePlan } from './budgetPlan'
import { fixturePlan, line } from './budgetFixtures'

const plan = (extra = {}) => normalizePlan({ ...fixturePlan(), ...extra })
const group = (overview, id) => overview.groups.find((g) => g.id === id)
const section = (overview, id) => overview.sections.find((s) => s.id === id)

describe('buildOverview — lo que se reparte cada mes', () => {
  const overview = buildOverview(plan())

  it('cuánto entra y cuánto se asigna', () => {
    expect(overview).toMatchObject({ income: 26000, assigned: 26000, remaining: 0, balanced: true, hasIncome: true })
  })

  it('agrupa en tarjeta, digital, efectivo y ahorro', () => {
    expect(overview.groups.map((g) => g.id)).toEqual(['tdc', 'digital', 'efectivo', 'ahorro'])
    expect(overview.groups.map((g) => g.amount)).toEqual([12000, 5000, 3000, 6000])
  })

  it('digital es débito + TDC2 y dice cuánto es de cada uno', () => {
    expect(group(overview, 'digital').parts).toEqual([
      { label: 'Débito', amount: 4000 },
      { label: 'TDC2', amount: 1000 },
    ])
  })

  it('los grupos suman todo lo asignado y sus porcentajes, 100%', () => {
    expect(overview.groups.reduce((s, g) => s + g.amount, 0)).toBe(overview.assigned)
    expect(overview.groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(100, 6)
    expect(group(overview, 'tdc').share).toBeCloseTo((12000 / 26000) * 100, 6)
  })

  it('los sobres de gasto diario son los de débito y efectivo (sin fondo ni bolsillos)', () => {
    expect(overview.spending.amount).toBe(7000)
    expect(overview.spending.share).toBeCloseTo((7000 / 26000) * 100, 6)
  })
})

describe('buildOverview — qué hay en cada cosa', () => {
  const overview = buildOverview(plan())

  it('una sección por medio con su total, cuántos renglones y su parte del ingreso', () => {
    expect(overview.sections.map((s) => s.id)).toEqual(['debito', 'efectivo', 'tdc2', 'tdc', 'ahorro'])
    expect(overview.sections.map((s) => [s.total, s.count])).toEqual([
      [4000, 2],
      [3000, 2],
      [1000, 3],
      [12000, 3],
      [6000, 2],
    ])
    expect(section(overview, 'tdc').share).toBeCloseTo((12000 / 26000) * 100, 6)
  })

  it('los renglones de cada sección suman el total de la sección', () => {
    for (const s of overview.sections) {
      expect(s.lines.reduce((sum, l) => sum + l.amount, 0)).toBe(s.total)
    }
  })

  it('los cargos de la TDC salen del más grande al más chico', () => {
    expect(section(overview, 'tdc').lines.map((l) => l.amount)).toEqual([7000, 4000, 1000])
  })

  it('cada renglón dice su día, su cobro o si es la válvula', () => {
    const tdc = section(overview, 'tdc').lines
    expect(tdc.find((l) => l.id === 'cargo-1').detail).toBe('Día 3')
    expect(tdc.find((l) => l.id === 'valvula').detail).toBe('Día 5 · válvula del plan')
    const tdc2 = section(overview, 'tdc2').lines
    expect(tdc2.find((l) => l.id === 'bolsillo-anual').detail).toBe('Cobro anual')
    expect(tdc2.find((l) => l.id === 'bolsillo-semestral').detail).toBe('Cobro semestral')
    expect(tdc2.find((l) => l.id === 'fondo').detail).toBe('')
    expect(section(overview, 'efectivo').lines.find((l) => l.id === 'sobre-e1').detail).toBe('Día 15')
  })

  it('una sección sin renglones no aparece', () => {
    const p = plan({ lines: [line('s1', 'debito', 'sobre', 100)] })
    expect(buildOverview(p).sections.map((s) => s.id)).toEqual(['debito'])
  })
})

describe('buildOverview — cuando el plan no cuadra o está vacío', () => {
  it('si se asigna más de lo que entra, los porcentajes son sobre lo asignado y no pasan de 100%', () => {
    const p = plan({ incomes: [{ id: 'a', name: 'A', amount: 10000, payDays: [15], covers: ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro'] }] })
    const overview = buildOverview(p)
    expect(overview.balanced).toBe(false)
    expect(overview.remaining).toBe(-16000)
    expect(overview.groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(100, 6)
  })

  it('si entra más de lo que se asigna, queda un restante y los porcentajes son sobre el ingreso', () => {
    const p = plan({ incomes: [{ id: 'a', name: 'A', amount: 40000, payDays: [15], covers: ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro'] }] })
    const overview = buildOverview(p)
    expect(overview.remaining).toBe(14000)
    expect(group(overview, 'tdc').share).toBeCloseTo((12000 / 40000) * 100, 6)
    expect(overview.groups.reduce((s, g) => s + g.share, 0)).toBeLessThan(100)
  })

  it('un plan vacío no se rompe: todo en cero', () => {
    const overview = buildOverview(normalizePlan(null))
    expect(overview).toMatchObject({ income: 0, assigned: 0, hasIncome: false, sections: [] })
    expect(overview.groups.every((g) => g.amount === 0 && g.share === 0)).toBe(true)
    expect(overview.spending).toEqual({ amount: 0, share: 0 })
  })
})

describe('summarizeAvailable — lo que se tiene ahora', () => {
  const item = (medio, kind, balance) => ({ line: { medio, kind }, balance })
  const items = [
    item('debito', 'sobre', 1300),
    item('debito', 'sobre', 600),
    item('efectivo', 'sobre', 250.5),
    item('tdc2', 'fondo', 500),
    item('tdc2', 'bolsillo', 400),
    item('tdc2', 'bolsillo', 100),
  ]

  it('separa débito, fondo general, bolsillos y efectivo', () => {
    const s = summarizeAvailable(items)
    expect(s).toMatchObject({ debito: 1900, fondo: 500, bolsillos: 500, efectivo: 250.5 })
  })

  it('digital es débito + TDC2 y el total suma digital y efectivo', () => {
    const s = summarizeAvailable(items)
    expect(s.digital).toBe(2900)
    expect(s.total).toBe(3150.5)
  })

  it('un sobre sobregirado resta', () => {
    expect(summarizeAvailable([item('debito', 'sobre', 100), item('debito', 'sobre', -40)]).debito).toBe(60)
  })

  it('sin sobres todo es cero', () => {
    expect(summarizeAvailable([])).toEqual({ debito: 0, fondo: 0, bolsillos: 0, digital: 0, efectivo: 0, total: 0 })
  })
})
