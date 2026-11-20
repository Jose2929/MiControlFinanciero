import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  annualContribution,
  buildFortnightPlan,
  checkBalance,
  clampedDate,
  expectedSpend,
  getCycleForDate,
  getCycleProgress,
  isDateInCycle,
  shiftCycle,
  splitAmount,
  sumLines,
  targetPerPayment,
  totalsByMedio,
  weeklyAllowance,
} from './budget'
import { toDateInputValue } from './format'
import { fixturePlan } from './budgetFixtures'

const ymd = toDateInputValue
const day = (y, m, d) => new Date(y, m - 1, d)

describe('dinero en centavos', () => {
  it('suma sin errores de coma flotante', () => {
    expect(sumLines([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
    expect(sumLines([{ amount: 357.5 }, { amount: 139.1 }])).toBe(496.6)
  })

  it('splitAmount reparte sin perder centavos', () => {
    expect(splitAmount(3000, 2)).toEqual([1500, 1500])
    expect(splitAmount(100.01, 2)).toEqual([50.01, 50])
    const parts = splitAmount(10, 3)
    expect(parts).toEqual([3.34, 3.33, 3.33])
    expect(sumLines(parts.map((amount) => ({ amount })))).toBe(10)
  })

  it('splitAmount tolera partes inválidas', () => {
    expect(splitAmount(500, 0)).toEqual([500])
    expect(splitAmount(500, undefined)).toEqual([500])
  })
})

describe('clampedDate', () => {
  it('recorta el día al último del mes', () => {
    expect(ymd(clampedDate(2027, 1, 30))).toBe('2027-02-28') // feb 2027 (mes 1 = febrero)
    expect(ymd(clampedDate(2028, 1, 30))).toBe('2028-02-29') // bisiesto
    expect(ymd(clampedDate(2026, 3, 31))).toBe('2026-04-30')
  })

  it('normaliza meses fuera de rango (cambio de año)', () => {
    expect(ymd(clampedDate(2026, 12, 15))).toBe('2027-01-15')
    expect(ymd(clampedDate(2026, -1, 15))).toBe('2025-12-15')
  })
})

describe('ciclos', () => {
  it('inicio día 1 = mes calendario', () => {
    const c = getCycleForDate(day(2026, 11, 19), 1)
    expect(ymd(c.start)).toBe('2026-11-01')
    expect(ymd(c.end)).toBe('2026-11-30')
    expect(c.days).toBe(30)
    expect(c.key).toBe('2026-11')
  })

  it('inicio día 15 va del 15 al 14 del siguiente mes', () => {
    const c = getCycleForDate(day(2026, 11, 19), 15)
    expect(ymd(c.start)).toBe('2026-11-15')
    expect(ymd(c.end)).toBe('2026-12-14')
    expect(c.days).toBe(30)
  })

  it('el día 14 todavía pertenece al ciclo anterior; el 15 abre el nuevo', () => {
    expect(ymd(getCycleForDate(day(2026, 11, 14), 15).start)).toBe('2026-10-15')
    expect(ymd(getCycleForDate(day(2026, 11, 14), 15).end)).toBe('2026-11-14')
    expect(ymd(getCycleForDate(day(2026, 11, 15), 15).start)).toBe('2026-11-15')
  })

  it('cruza el cambio de año', () => {
    const c = getCycleForDate(day(2027, 1, 10), 15)
    expect(ymd(c.start)).toBe('2026-12-15')
    expect(ymd(c.end)).toBe('2027-01-14')
    expect(c.key).toBe('2026-12')
  })

  it('febrero tiene 28 días y 29 en bisiesto', () => {
    expect(getCycleForDate(day(2027, 2, 10), 1).days).toBe(28)
    expect(getCycleForDate(day(2028, 2, 10), 1).days).toBe(29)
  })

  it('inicio día 30 se recorta en febrero sin romper el ciclo', () => {
    const jan = getCycleForDate(day(2027, 1, 31), 30)
    expect(ymd(jan.start)).toBe('2027-01-30')
    expect(ymd(jan.end)).toBe('2027-02-27')

    const feb27 = getCycleForDate(day(2027, 2, 27), 30)
    expect(ymd(feb27.start)).toBe('2027-01-30') // todavía no llega el 28

    const feb28 = getCycleForDate(day(2027, 2, 28), 30)
    expect(ymd(feb28.start)).toBe('2027-02-28')
    expect(ymd(feb28.end)).toBe('2027-03-29')
    expect(feb28.days).toBe(30)
  })

  it('los ciclos consecutivos no dejan huecos ni se traslapan', () => {
    for (const startDay of [1, 15, 30]) {
      let cycle = getCycleForDate(day(2026, 10, 3), startDay)
      for (let i = 0; i < 18; i += 1) {
        const next = shiftCycle(cycle, 1)
        const dayAfterEnd = new Date(cycle.end)
        dayAfterEnd.setDate(dayAfterEnd.getDate() + 1)
        expect(ymd(next.start)).toBe(ymd(dayAfterEnd))
        cycle = next
      }
    }
  })

  it('shiftCycle va hacia atrás y adelante, incluso entre años', () => {
    const nov = getCycleForDate(day(2026, 11, 19), 1)
    expect(ymd(shiftCycle(nov, -1).start)).toBe('2026-10-01')
    expect(shiftCycle(nov, -1).days).toBe(31)
    expect(ymd(shiftCycle(nov, 1).start)).toBe('2026-12-01')
    const jan = getCycleForDate(day(2027, 1, 5), 1)
    expect(ymd(shiftCycle(jan, -1).start)).toBe('2026-12-01')
    expect(shiftCycle(shiftCycle(nov, 3), -3).key).toBe(nov.key)
  })

  it('isDateInCycle incluye ambos extremos', () => {
    const c = getCycleForDate(day(2026, 11, 19), 15)
    expect(isDateInCycle(day(2026, 11, 15), c)).toBe(true)
    expect(isDateInCycle(day(2026, 12, 14), c)).toBe(true)
    expect(isDateInCycle(day(2026, 11, 14), c)).toBe(false)
    expect(isDateInCycle(day(2026, 12, 15), c)).toBe(false)
  })

  it('un día de inicio inválido cae al valor por defecto; uno fuera de rango se acota a 31', () => {
    expect(ymd(getCycleForDate(day(2026, 11, 19), 'x').start)).toBe('2026-11-01')
    // 99 → 31, y noviembre solo tiene 30 días: el 19 aún es del ciclo que
    // arrancó el 31 de octubre.
    const clamped = getCycleForDate(day(2026, 11, 19), 99)
    expect(ymd(clamped.start)).toBe('2026-10-31')
    expect(ymd(clamped.end)).toBe('2026-11-29')
  })
})

describe('ritmo del ciclo', () => {
  const nov = getCycleForDate(day(2026, 11, 19), 1)

  it('cuenta el día de hoy y los días que quedan (hoy incluido)', () => {
    expect(getCycleProgress(nov, day(2026, 11, 19))).toMatchObject({
      status: 'current',
      totalDays: 30,
      dayNumber: 19,
      daysLeft: 12,
    })
    expect(getCycleProgress(nov, day(2026, 11, 1))).toMatchObject({ dayNumber: 1, daysLeft: 30 })
    expect(getCycleProgress(nov, day(2026, 11, 30))).toMatchObject({ dayNumber: 30, daysLeft: 1 })
  })

  it('ciclos pasados y futuros', () => {
    expect(getCycleProgress(nov, day(2026, 12, 5))).toMatchObject({ status: 'past', dayNumber: 30, daysLeft: 0 })
    expect(getCycleProgress(nov, day(2026, 10, 20))).toMatchObject({ status: 'future', dayNumber: 0, daysLeft: 30 })
  })

  it('gasto esperado es proporcional a los días transcurridos', () => {
    expect(expectedSpend(4000, nov, day(2026, 11, 19))).toBe(2533.33)
    expect(expectedSpend(3000, nov, day(2026, 11, 15))).toBe(1500)
    expect(expectedSpend(4000, nov, day(2026, 10, 31))).toBe(0)
    expect(expectedSpend(4000, nov, day(2026, 12, 20))).toBe(4000)
  })

  it('aproximado por semana restante', () => {
    // 12 días por vivir = 12/7 semanas → 1200 / (12/7) = 700 por semana
    expect(weeklyAllowance(1200, nov, day(2026, 11, 19))).toBe(700)
  })

  it('con menos de una semana, todo el saldo cuenta como la semana', () => {
    expect(weeklyAllowance(500, nov, day(2026, 11, 28))).toBe(500)
  })

  it('ciclo terminado → 0; saldo negativo se conserva', () => {
    expect(weeklyAllowance(500, nov, day(2026, 12, 3))).toBe(0)
    expect(weeklyAllowance(-100, nov, day(2026, 11, 28))).toBe(-100)
  })
})

describe('cuadre del plan', () => {
  it('totales por medio', () => {
    expect(totalsByMedio(fixturePlan())).toEqual({
      tdc: 12000,
      tdc2: 1000,
      debito: 4000,
      efectivo: 3000,
      ahorro: 6000,
    })
  })

  it('un plan cuadrado deja restante 0 por ingreso y en total', () => {
    const result = checkBalance(fixturePlan())
    expect(result.balanced).toBe(true)
    expect(result.remaining).toBe(0)
    expect(result.uncovered).toBe(0)
    expect(result.incomes.map((i) => [i.id, i.assigned, i.remaining])).toEqual([
      ['a', 20000, 0],
      ['b', 6000, 0],
    ])
  })

  it('si un gasto crece, el restante es negativo y ya no cuadra', () => {
    const plan = fixturePlan()
    plan.lines.find((l) => l.id === 'sobre-d1').amount += 250
    const result = checkBalance(plan)
    expect(result.balanced).toBe(false)
    expect(result.incomes[0].remaining).toBe(-250)
    expect(result.remaining).toBe(-250)
  })

  it('si un gasto baja, sobra dinero sin asignar', () => {
    const plan = fixturePlan()
    plan.lines = plan.lines.filter((l) => l.id !== 'valvula')
    const result = checkBalance(plan)
    expect(result.balanced).toBe(false)
    expect(result.incomes[0].remaining).toBe(1000)
  })

  it('una línea de un medio que ningún ingreso cubre rompe el cuadre', () => {
    const plan = fixturePlan()
    plan.incomes[0].covers = ['tdc', 'tdc2', 'debito'] // ya nadie cubre efectivo
    const result = checkBalance(plan)
    expect(result.uncovered).toBe(3000)
    expect(result.balanced).toBe(false)
  })

  it('sin ingresos no se considera cuadrado', () => {
    expect(checkBalance({ incomes: [], lines: [] }).balanced).toBe(false)
  })
})

describe('plan por quincena', () => {
  it('reparte el día de gasto y retiene para la TDC', () => {
    const plan = buildFortnightPlan(fixturePlan())
    const [d15, d30] = plan.days

    expect(d15.day).toBe(15)
    expect(d15.income).toBe(10000)
    expect(d15.transfers.map((t) => [t.id, t.amount])).toEqual([
      ['tdc2', 1000],
      ['debito', 4000],
      ['efectivo', 3000],
    ])
    expect(d15.transfers[2]).toMatchObject({ via: 'debito', purpose: 'retirar-efectivo', parts: [1500, 1500] })
    expect(d15.retainedForTdc).toBe(2000)

    expect(d30.day).toBe(30)
    expect(d30.transfers).toEqual([])
    expect(d30.retainedForTdc).toBe(10000)
  })

  it('lo retenido (día 30 anterior + día 15) paga la TDC completa', () => {
    const plan = buildFortnightPlan(fixturePlan())
    expect(plan.tdcDue).toBe(12000)
    expect(plan.tdcFunded).toBe(12000)
    expect(plan.tdcGap).toBe(0)
    expect(plan.spendTransferDayValid).toBe(true)
  })

  it('si el plan no cuadra, tdcGap lo muestra', () => {
    const plan = fixturePlan()
    plan.lines.find((l) => l.id === 'cargo-1').amount += 500
    expect(buildFortnightPlan(plan).tdcGap).toBe(500)
  })

  it('el retiro de efectivo se parte según la configuración', () => {
    const plan = fixturePlan()
    plan.settings.cashWithdrawalParts = 3
    const cash = buildFortnightPlan(plan).days[0].transfers[2]
    expect(cash.parts).toEqual([1000, 1000, 1000])
  })

  it('avisa si el día de reparto no es un día de sueldo', () => {
    const plan = fixturePlan()
    plan.settings.spendTransferDay = 10
    const result = buildFortnightPlan(plan)
    expect(result.spendTransferDayValid).toBe(false)
    expect(result.days.every((d) => d.transfers.length === 0)).toBe(true)
  })

  it('sin un ingreso que cubra la TDC no hay plan', () => {
    const plan = fixturePlan()
    plan.incomes = plan.incomes.filter((i) => i.id === 'b')
    expect(buildFortnightPlan(plan)).toBeNull()
  })
})

describe('bolsillos', () => {
  const plan = fixturePlan()
  const get = (id) => plan.lines.find((l) => l.id === id)

  it('cuánto se junta al año', () => {
    expect(annualContribution(get('bolsillo-anual'))).toBe(4800)
    expect(annualContribution(get('bolsillo-semestral'))).toBe(1200)
  })

  it('cuánto debe haber juntado cuando llega el cobro', () => {
    expect(targetPerPayment(get('bolsillo-anual'))).toBe(4800)
    expect(targetPerPayment(get('bolsillo-semestral'))).toBe(600)
    expect(targetPerPayment(get('cargo-1'))).toBe(7000)
  })

  it('el fondo general no tiene meta de cobro', () => {
    expect(targetPerPayment(get('fondo'))).toBeNull()
  })
})

// Plan real (opcional): solo corre si existe budget-seed.json en esta máquina.
// Valida que TU tabla cuadre sin escribir tus cifras en el código versionado.
const seedPath = resolve(process.cwd(), 'budget-seed.json')
describe.skipIf(!existsSync(seedPath))('plan real (budget-seed.json, local)', () => {
  const seed = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : null

  it('cuadra: restante 0 en cada ingreso', () => {
    const result = checkBalance(seed)
    expect(result.balanced).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('lo retenido de los sueldos paga la TDC completa', () => {
    const plan = buildFortnightPlan(seed)
    expect(plan.tdcGap).toBe(0)
    expect(plan.spendTransferDayValid).toBe(true)
  })

  it('todas las líneas tienen id único y medio válido', () => {
    const ids = seed.lines.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(seed.lines.every((l) => ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro'].includes(l.medio))).toBe(true)
  })
})
