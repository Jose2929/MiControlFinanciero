import { describe, it, expect } from 'vitest'
import {
  EVENT_KINDS,
  buildMonthEvents,
  countChecks,
  dayStatus,
  daysInMonth,
  kindsOfDay,
  monthKey,
} from './budgetCalendar'
import { normalizePlan } from './budgetPlan'
import { fixturePlan, line } from './budgetFixtures'

// Plan ficticio: corte el 12 y límite el 3 (del mes siguiente), como el real.
const plan = (extra = {}) => {
  const base = fixturePlan()
  return normalizePlan({
    ...base,
    settings: { ...base.settings, cutDay: 12, payDueDay: 3 },
    ...extra,
  })
}

const DEC = [2026, 11]
const on = (result, day) => result.byDay[day] || []
const find = (result, key) => result.events.find((e) => e.key === key)

describe('monthKey y daysInMonth', () => {
  it('arma la clave AAAA-MM (el mes va de 0 a 11)', () => {
    expect(monthKey(2026, 11)).toBe('2026-12')
    expect(monthKey(2026, 0)).toBe('2026-01')
  })

  it('pasarse de diciembre da enero del año siguiente', () => {
    expect(monthKey(2026, 12)).toBe('2027-01')
    expect(monthKey(2026, -1)).toBe('2025-12')
  })

  it('cuenta los días del mes, con febrero bisiesto', () => {
    expect(daysInMonth(2026, 11)).toBe(31)
    expect(daysInMonth(2027, 1)).toBe(28)
    expect(daysInMonth(2028, 1)).toBe(29)
  })
})

describe('buildMonthEvents — sueldos', () => {
  const result = buildMonthEvents(plan(), ...DEC)

  it('reparte el sueldo entre sus días de pago', () => {
    const a15 = find(result, 'ing_a_15')
    const a30 = find(result, 'ing_a_30')
    expect([a15.day, a15.amount, a15.title]).toEqual([15, 10000, 'Sueldo de Persona A'])
    expect([a30.day, a30.amount]).toEqual([30, 10000])
    expect(a15.subtitle).toBe('Pago 1 de 2')
    expect(a30.subtitle).toBe('Pago 2 de 2')
  })

  it('un sueldo de un solo pago va completo y sin subtítulo', () => {
    const b = find(result, 'ing_b_30')
    expect([b.day, b.amount, b.subtitle]).toEqual([30, 6000, ''])
  })

  it('el día 30 en febrero cae en el último día del mes', () => {
    expect(find(buildMonthEvents(plan(), 2027, 1), 'ing_a_30').day).toBe(28)
    expect(find(buildMonthEvents(plan(), 2028, 1), 'ing_a_30').day).toBe(29)
  })

  it('un día 15 y un 30 que quedan en el mismo día no se pisan (llaves distintas)', () => {
    const p = plan({ incomes: [{ id: 'x', name: 'X', amount: 100, payDays: [29, 30], covers: ['tdc'] }] })
    const r = buildMonthEvents(p, 2027, 1)
    const keys = r.events.filter((e) => e.kind === 'ingreso').map((e) => e.key)
    expect(new Set(keys).size).toBe(2)
    expect(r.events.filter((e) => e.kind === 'ingreso').every((e) => e.day === 28)).toBe(true)
  })
})

describe('buildMonthEvents — reparto del sueldo', () => {
  const result = buildMonthEvents(plan(), ...DEC)

  it('el día del reparto pasa a TDC2, a débito y al débito para el efectivo', () => {
    expect(find(result, 'trf_15_tdc2')).toMatchObject({ day: 15, title: 'Pasar a TDC2', amount: 1000 })
    expect(find(result, 'trf_15_debito')).toMatchObject({ day: 15, title: 'Pasar al Débito', amount: 4000 })
    const cash = find(result, 'trf_15_efectivo')
    expect(cash).toMatchObject({ day: 15, title: 'Pasar al Débito para el efectivo', amount: 3000 })
    expect(cash.subtitle).toBe('Se retira en 2 partes: $1,500 + $1,500')
  })

  it('lo que sobra de cada sueldo se deja para la TDC', () => {
    expect(find(result, 'trf_15_tdc')).toMatchObject({ day: 15, title: 'Dejar para la TDC', amount: 2000 })
    expect(find(result, 'trf_30_tdc')).toMatchObject({ day: 30, amount: 10000 })
  })

  it('lo dejado para la TDC cubre justo lo que hay que pagar', () => {
    const retained = result.events.filter((e) => e.key.startsWith('trf_') && e.key.endsWith('_tdc')).reduce((s, e) => s + e.amount, 0)
    expect(retained).toBe(result.totals.pago)
    expect(retained).toBe(12000)
  })

  it('si el reparto no cae en un día de pago, no hay transferencias', () => {
    const p = plan({ settings: { ...fixturePlan().settings, cutDay: 12, payDueDay: 3, spendTransferDay: 20 } })
    const r = buildMonthEvents(p, ...DEC)
    expect(r.events.some((e) => e.key.startsWith('trf_20') || e.key === 'trf_15_tdc2')).toBe(false)
  })
})

describe('buildMonthEvents — renglones con día de pago', () => {
  const result = buildMonthEvents(plan(), ...DEC)

  it('los cargos de la TDC salen en su día, y la válvula lo dice', () => {
    expect(find(result, 'cargo_cargo-1')).toMatchObject({ day: 3, amount: 7000, kind: 'cargo' })
    expect(find(result, 'cargo_cargo-2')).toMatchObject({ day: 10, amount: 4000 })
    const valve = find(result, 'cargo_valvula')
    expect(valve).toMatchObject({ day: 5, isValve: true })
    expect(valve.subtitle).toContain('válvula')
  })

  it('los ahorros programados salen su día', () => {
    expect(on(result, 1).filter((e) => e.kind === 'ahorro').map((e) => e.amount)).toEqual([3000, 3000])
  })

  it('un gasto programado de un sobre dice de dónde sale', () => {
    expect(find(result, 'sobre_sobre-e1')).toMatchObject({ day: 15, kind: 'gasto', amount: 2000, subtitle: 'Gasto programado · Efectivo' })
  })

  it('lo que no tiene día de pago (sobres, fondo, bolsillos) no sale', () => {
    const titles = result.events.map((e) => e.title)
    for (const name of ['fondo', 'sobre-d1', 'sobre-d2', 'sobre-e2', 'bolsillo-anual', 'bolsillo-semestral']) {
      expect(titles).not.toContain(name)
    }
  })

  it('un cargo que no es mensual no sale (no sabemos en qué mes cae)', () => {
    const p = plan()
    p.lines.push({ ...line('seguro-anual', 'tdc', 'cargo', 5000, { payDay: 8, payFrequency: 'anual' }) })
    expect(buildMonthEvents(p, ...DEC).events.some((e) => e.key === 'cargo_seguro-anual')).toBe(false)
  })

  it('un renglón sin frecuencia se toma como mensual', () => {
    const p = plan()
    p.lines.push({ ...line('suscripcion', 'tdc', 'cargo', 99, { payDay: 8, payFrequency: null }) })
    expect(buildMonthEvents(p, ...DEC).events.some((e) => e.key === 'cargo_suscripcion')).toBe(true)
  })

  it('un día 30 en un renglón también se ajusta en febrero', () => {
    const p = plan()
    p.lines.push({ ...line('agua', 'tdc', 'cargo', 165, { payDay: 30 }) })
    expect(find(buildMonthEvents(p, 2027, 1), 'cargo_agua').day).toBe(28)
  })
})

describe('buildMonthEvents — corte y pago de la TDC', () => {
  it('el corte es el 12 y no se puede marcar', () => {
    const corte = find(buildMonthEvents(plan(), ...DEC), 'corte_tdc')
    expect([corte.day, corte.kind, corte.checkable, corte.amount]).toEqual([12, 'corte', false, null])
  })

  it('el pago es el 3 por el total de los cargos y viene del corte del mes anterior', () => {
    const pago = find(buildMonthEvents(plan(), ...DEC), 'pago_tdc')
    expect([pago.day, pago.kind, pago.amount, pago.checkable]).toEqual([3, 'pago', 12000, true])
    expect(pago.subtitle).toBe('Estado con corte del 12 de noviembre')
  })

  it('en enero el pago es del corte de diciembre (cruza el año)', () => {
    expect(find(buildMonthEvents(plan(), 2027, 0), 'pago_tdc').subtitle).toBe('Estado con corte del 12 de diciembre')
  })

  it('si el límite es después del corte, es del mismo mes', () => {
    const p = plan({ settings: { ...fixturePlan().settings, cutDay: 12, payDueDay: 25 } })
    const pago = find(buildMonthEvents(p, ...DEC), 'pago_tdc')
    expect([pago.day, pago.subtitle]).toEqual([25, 'Estado con corte del 12 de diciembre'])
  })

  it('sin renglones en la TDC no hay corte ni pago', () => {
    const p = plan({ lines: [line('ahorro-1', 'ahorro', 'ahorro', 100, { payDay: 1 })] })
    const r = buildMonthEvents(p, ...DEC)
    expect(r.events.some((e) => e.kind === 'corte' || e.kind === 'pago')).toBe(false)
  })
})

describe('buildMonthEvents — orden, llaves y totales', () => {
  const result = buildMonthEvents(plan(), ...DEC)

  it('agrupa por día y dentro de cada día ordena por tipo', () => {
    // El 3: el pago de la TDC va antes que el cargo del día.
    expect(on(result, 3).map((e) => e.kind)).toEqual(['pago', 'cargo'])
    // El 15: sueldo, transferencias y el gasto programado.
    const kinds = on(result, 15).map((e) => e.kind)
    expect(kinds[0]).toBe('ingreso')
    expect(kinds).toContain('transferencia')
    expect(kinds[kinds.length - 1]).toBe('gasto')
    expect(Object.keys(result.byDay).every((d) => on(result, d).every((e) => e.day === Number(d)))).toBe(true)
  })

  it('los eventos salen en orden de día', () => {
    const days = result.events.map((e) => e.day)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('cada evento tiene una llave única, válida para Firebase', () => {
    const keys = result.events.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => /^[A-Za-z0-9_-]+$/.test(k))).toBe(true)
  })

  it('las llaves son las mismas todos los meses (así la palomita sigue a su evento)', () => {
    const keysOf = (y, m) => buildMonthEvents(plan(), y, m).events.map((e) => e.key).sort()
    expect(keysOf(2026, 11)).toEqual(keysOf(2027, 1))
  })

  it('un id raro no rompe la llave', () => {
    const p = plan()
    p.lines.push({ ...line('con.punto/raro', 'tdc', 'cargo', 10, { payDay: 9 }) })
    const key = buildMonthEvents(p, ...DEC).events.find((e) => e.title === 'con.punto/raro').key
    expect(key).toBe('cargo_con_punto_raro')
  })

  it('suma lo que entra, lo que se paga a la TDC, el ahorro y los cargos', () => {
    expect(result.totals).toEqual({ ingreso: 26000, pago: 12000, ahorro: 6000, cargos: 12000 })
  })

  it('los tipos conocidos son los que se usan', () => {
    expect(result.events.every((e) => EVENT_KINDS.includes(e.kind))).toBe(true)
  })
})

describe('palomitas', () => {
  const result = buildMonthEvents(plan(), ...DEC)
  const checkable = result.events.filter((e) => e.checkable)

  it('cuenta lo hecho entre lo que se puede marcar (el corte no cuenta)', () => {
    expect(countChecks(result.events, {})).toEqual({ done: 0, total: checkable.length })
    // Aunque venga marcado, el corte no cuenta: no es algo que se haga.
    expect(countChecks(result.events, { ing_a_15: true, corte_tdc: true, pago_tdc: true })).toEqual({
      done: 2,
      total: checkable.length,
    })
    expect(checkable.length).toBe(result.events.length - 1)
  })

  it('solo una palomita encendida cuenta; otros valores no', () => {
    expect(countChecks(result.events, { ing_a_15: false, ing_a_30: 'si' }).done).toBe(0)
  })

  it('el estado de un día: nada que marcar, pendiente, a medias o hecho', () => {
    const day3 = on(result, 3) // pago + cargo
    expect(dayStatus([], {})).toBe('none')
    expect(dayStatus(on(result, 12), {})).toBe('none') // solo el corte
    expect(dayStatus(day3, {})).toBe('pending')
    expect(dayStatus(day3, { pago_tdc: true })).toBe('partial')
    expect(dayStatus(day3, { pago_tdc: true, 'cargo_cargo-1': true })).toBe('done')
  })

  it('los tipos de un día traen cuántos hay y si todos están hechos', () => {
    const day1 = on(result, 1)
    expect(kindsOfDay(day1, {})).toEqual([{ kind: 'ahorro', count: 2, done: false }])
    expect(kindsOfDay(day1, { 'ahorro_ahorro-1': true })[0].done).toBe(false)
    expect(kindsOfDay(day1, { 'ahorro_ahorro-1': true, 'ahorro_ahorro-2': true })[0].done).toBe(true)
  })

  it('el corte nunca cuenta como hecho (no se marca)', () => {
    expect(kindsOfDay(on(result, 12), { corte_tdc: true })).toEqual([{ kind: 'corte', count: 1, done: false }])
  })
})
