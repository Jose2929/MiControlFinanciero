import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SETTINGS, checkBalance } from './budget'
import { fixturePlan } from './budgetFixtures'
import {
  isValidDay,
  isValidSettingValue,
  lineKindFor,
  nextOrder,
  normalizeIncome,
  normalizeLine,
  normalizePlan,
  normalizeSettings,
  planToExport,
  planToTree,
  safeId,
  validatePlanInput,
} from './budgetPlan'

// Lo que hace RTDB al guardar: descarta null y arreglos/objetos vacíos.
function rtdbLike(value) {
  if (Array.isArray(value)) {
    const items = value.map(rtdbLike)
    return items.length ? items : undefined
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, rtdbLike(v)])
      .filter(([, v]) => v !== null && v !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value
}

describe('lineKindFor', () => {
  it('deduce el tipo según medio y frecuencia', () => {
    expect(lineKindFor('tdc')).toBe('cargo')
    expect(lineKindFor('tdc2', 'anual')).toBe('bolsillo')
    expect(lineKindFor('tdc2', null)).toBe('fondo')
    expect(lineKindFor('debito')).toBe('sobre')
    expect(lineKindFor('efectivo')).toBe('sobre')
    expect(lineKindFor('ahorro')).toBe('ahorro')
  })
})

describe('validaciones sueltas', () => {
  it('safeId quita los caracteres que RTDB no admite en una clave', () => {
    expect(safeId('a.b/c#d$e[f]')).toBe('a-b-c-d-e-f-')
    expect(safeId('  tdc-netflix ')).toBe('tdc-netflix')
  })

  it('isValidDay', () => {
    expect([1, 15, 31, '7'].every(isValidDay)).toBe(true)
    expect([0, 32, 1.5, '', null, undefined, 'x'].some(isValidDay)).toBe(false)
  })

  it('isValidSettingValue respeta cada rango', () => {
    expect(isValidSettingValue('cycleStartDay', 31)).toBe(true)
    expect(isValidSettingValue('cycleStartDay', 32)).toBe(false)
    expect(isValidSettingValue('cashWithdrawalParts', 6)).toBe(true)
    expect(isValidSettingValue('cashWithdrawalParts', 7)).toBe(false)
    expect(isValidSettingValue('cashWithdrawalParts', 0)).toBe(false)
    expect(isValidSettingValue('noExiste', 3)).toBe(false)
  })
})

describe('normalizeLine', () => {
  it('rechaza lo que no tiene medio válido', () => {
    expect(normalizeLine(null)).toBeNull()
    expect(normalizeLine('texto')).toBeNull()
    expect(normalizeLine({ medio: 'banco', name: 'x', amount: 1 })).toBeNull()
  })

  it('rellena valores seguros cuando faltan o vienen mal', () => {
    const l = normalizeLine({ medio: 'debito', amount: -5, payDay: 32, name: '  ' }, 'id-x', 4)
    expect(l).toMatchObject({
      id: 'id-x',
      name: 'Sin nombre',
      amount: 0,
      payDay: null,
      payFrequency: 'mensual',
      isValve: false,
      order: 4,
    })
  })

  it('redondea a centavos y acepta montos como texto', () => {
    expect(normalizeLine({ medio: 'tdc', name: 'x', amount: '357.5' }).amount).toBe(357.5)
    expect(normalizeLine({ medio: 'tdc', name: 'x', amount: 12.341 }).amount).toBe(12.34)
  })

  it('el tipo siempre se deduce, aunque el dato diga otra cosa', () => {
    const l = normalizeLine({ medio: 'tdc2', kind: 'cargo', name: 'x', amount: 1, payFrequency: 'anual' })
    expect(l.kind).toBe('bolsillo')
    const fondo = normalizeLine({ medio: 'tdc2', kind: 'bolsillo', name: 'x', amount: 1 })
    expect(fondo.kind).toBe('fondo')
    expect(fondo.payFrequency).toBeNull()
  })

  it('fuera de TDC2 la frecuencia siempre es mensual', () => {
    expect(normalizeLine({ medio: 'tdc', name: 'x', amount: 1, payFrequency: 'anual' }).payFrequency).toBe('mensual')
  })

  it('isValve solo es true si viene exactamente true', () => {
    expect(normalizeLine({ medio: 'tdc', name: 'x', amount: 1, isValve: true }).isValve).toBe(true)
    expect(normalizeLine({ medio: 'tdc', name: 'x', amount: 1, isValve: 'true' }).isValve).toBe(false)
  })

  it('limpia el id', () => {
    expect(normalizeLine({ id: 'a.b', medio: 'tdc', name: 'x', amount: 1 }).id).toBe('a-b')
  })
})

describe('normalizeIncome', () => {
  it('lee los días aunque RTDB los devuelva como objeto, y los ordena sin repetir', () => {
    const i = normalizeIncome({ name: 'Sueldo', amount: 100, payDays: { 0: 30, 1: 15, 2: 15, 3: 99 } }, 'x')
    expect(i.payDays).toEqual([15, 30])
  })

  it('"covers" respeta el orden de los medios y descarta lo inválido', () => {
    const i = normalizeIncome({ name: 's', amount: 1, covers: ['ahorro', 'tdc', 'nada'] }, 'x')
    expect(i.covers).toEqual(['tdc', 'ahorro'])
  })

  it('valores por defecto', () => {
    expect(normalizeIncome({}, 'x')).toEqual({ id: 'x', name: 'Ingreso', amount: 0, payDays: [], covers: [] })
    expect(normalizeIncome(null)).toBeNull()
  })
})

describe('normalizeSettings', () => {
  it('sin datos devuelve los valores por defecto', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  it('acepta valores válidos y descarta los inválidos campo por campo', () => {
    const s = normalizeSettings({ cycleStartDay: 15, cutDay: 99, payDueDay: 'x', cashWithdrawalParts: '3', otra: 1 })
    expect(s.cycleStartDay).toBe(15)
    expect(s.cutDay).toBe(DEFAULT_SETTINGS.cutDay)
    expect(s.payDueDay).toBe(DEFAULT_SETTINGS.payDueDay)
    expect(s.cashWithdrawalParts).toBe(3)
    expect(s).not.toHaveProperty('otra')
  })
})

describe('normalizePlan', () => {
  it('nunca lanza con datos vacíos o basura', () => {
    for (const raw of [null, undefined, 'x', 5, [], {}]) {
      const plan = normalizePlan(raw)
      expect(plan.lines).toEqual([])
      expect(plan.incomes).toEqual([])
      expect(plan.settings).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('lee un nodo con la forma que devuelve RTDB (mapas, sin nulls)', () => {
    const raw = {
      settings: { cycleStartDay: 1 },
      incomes: { inc1: { id: 'inc1', name: 'Sueldo', amount: 100, payDays: { 0: 15, 1: 30 }, covers: { 0: 'tdc' } } },
      lines: {
        l2: { id: 'l2', medio: 'tdc', name: 'B', amount: 5, order: 1 }, // sin payDay ni isValve
        l1: { id: 'l1', medio: 'tdc', name: 'A', amount: 7, order: 0, payDay: 9 },
      },
    }
    const plan = normalizePlan(raw)
    expect(plan.incomes[0]).toMatchObject({ id: 'inc1', payDays: [15, 30], covers: ['tdc'] })
    expect(plan.lines.map((l) => l.id)).toEqual(['l1', 'l2']) // por `order`, no por clave
    expect(plan.lines[1]).toMatchObject({ payDay: null, isValve: false })
  })

  it('a igual orden, desempata por nombre', () => {
    const plan = normalizePlan({
      lines: [
        { id: 'z', medio: 'tdc', name: 'Zeta', amount: 1, order: 0 },
        { id: 'a', medio: 'tdc', name: 'Alfa', amount: 1, order: 0 },
      ],
    })
    expect(plan.lines.map((l) => l.name)).toEqual(['Alfa', 'Zeta'])
  })

  it('en arreglos sin `order`, conserva el orden del arreglo', () => {
    const plan = normalizePlan(fixturePlan())
    expect(plan.lines.map((l) => l.id)).toEqual(fixturePlan().lines.map((l) => l.id))
  })

  it('ignora renglones sin medio válido', () => {
    const plan = normalizePlan({ lines: [{ id: 'x', medio: 'banco', name: 'x', amount: 1 }, null, 5] })
    expect(plan.lines).toEqual([])
  })
})

describe('forma de guardado (árbol RTDB)', () => {
  const plan = normalizePlan(fixturePlan())

  it('no trae `undefined` (Firebase lo rechaza)', () => {
    const tree = planToTree(plan)
    expect(JSON.parse(JSON.stringify(tree))).toStrictEqual(tree)
  })

  it('guarda colecciones como mapas por id', () => {
    const tree = planToTree(plan)
    expect(Object.keys(tree.lines)).toHaveLength(plan.lines.length)
    expect(tree.lines['cargo-1']).toMatchObject({ id: 'cargo-1', medio: 'tdc', amount: 7000 })
    expect(Object.keys(tree.incomes)).toEqual(['a', 'b'])
  })

  it('ida y vuelta: lo guardado se lee igual', () => {
    expect(normalizePlan(planToTree(plan))).toEqual(plan)
  })

  it('ida y vuelta pasando por las rarezas de RTDB (sin nulls ni vacíos)', () => {
    const stored = rtdbLike(JSON.parse(JSON.stringify(planToTree(plan))))
    expect(normalizePlan(stored)).toEqual(plan)
  })

  it('un renglón nuevo queda al final', () => {
    expect(nextOrder(plan.lines)).toBe(plan.lines.length)
    expect(nextOrder([])).toBe(0)
  })
})

describe('respaldo en archivo: exportar e importar', () => {
  const plan = normalizePlan(fixturePlan())

  it('lo exportado se vuelve a importar idéntico (incluido el orden)', () => {
    const exported = planToExport(plan)
    expect(exported.lines.every((l) => !('order' in l))).toBe(true)
    const result = validatePlanInput(JSON.stringify(exported))
    expect(result.ok).toBe(true)
    expect(result.plan).toEqual(plan)
  })

  it('el plan importado cuadra igual que el original', () => {
    const result = validatePlanInput(planToExport(plan))
    expect(checkBalance(result.plan).balanced).toBe(true)
  })

  it('acepta un string JSON o un objeto, y no modifica lo que recibe', () => {
    const input = fixturePlan()
    const copy = JSON.stringify(input)
    expect(validatePlanInput(input).ok).toBe(true)
    expect(JSON.stringify(input)).toBe(copy)
    expect(validatePlanInput(copy).ok).toBe(true)
  })
})

describe('validatePlanInput rechaza lo dudoso', () => {
  const errorsOf = (input) => validatePlanInput(input).errors.join(' | ')

  it('JSON inválido, o con otra forma', () => {
    expect(validatePlanInput('{no es json')).toMatchObject({ ok: false, plan: null })
    expect(errorsOf('{no es json')).toContain('JSON válido')
    expect(errorsOf([])).toContain('forma de un plan')
    expect(errorsOf('5')).toContain('forma de un plan')
    expect(errorsOf({ otra: 1 })).toContain('No parece un plan')
  })

  it('renglón con medio, nombre, monto, día o frecuencia inválidos', () => {
    const bad = (extra) => ({ lines: [{ id: 'x', medio: 'tdc', name: 'Netflix', amount: 10, ...extra }] })
    expect(errorsOf(bad({ medio: 'banco' }))).toContain('medio inválido')
    expect(errorsOf(bad({ name: ' ' }))).toContain('falta el nombre')
    expect(errorsOf(bad({ amount: -1 }))).toContain('monto inválido')
    expect(errorsOf(bad({ amount: 'abc' }))).toContain('monto inválido')
    expect(errorsOf(bad({ payDay: 40 }))).toContain('del 1 al 31')
    expect(errorsOf(bad({ payFrequency: 'diario' }))).toContain('frecuencia inválida')
  })

  it('nombra el renglón con problema para poder encontrarlo', () => {
    expect(errorsOf({ lines: [{ id: 'x', medio: 'tdc', name: 'Netflix', amount: -1 }] })).toContain('Línea 1 ("Netflix")')
  })

  it('un bolsillo sin frecuencia de cobro', () => {
    const input = { lines: [{ id: 'x', medio: 'tdc2', kind: 'bolsillo', name: 'Moto', amount: 5 }] }
    expect(errorsOf(input)).toContain('necesita su frecuencia')
  })

  it('ids repetidos (renglones e ingresos)', () => {
    const lines = [
      { id: 'dup', medio: 'tdc', name: 'A', amount: 1 },
      { id: 'dup', medio: 'tdc', name: 'B', amount: 1 },
    ]
    expect(errorsOf({ lines })).toContain('repetido')
    const incomes = [
      { id: 'i', name: 'A', amount: 1, payDays: [15], covers: ['tdc'] },
      { id: 'i', name: 'B', amount: 1, payDays: [15], covers: ['tdc'] },
    ]
    expect(errorsOf({ incomes })).toContain('repetido')
  })

  it('ingreso sin días de pago, con días fuera de rango o con medios inventados', () => {
    const inc = (extra) => ({ incomes: [{ id: 'i', name: 'S', amount: 1, payDays: [15], covers: ['tdc'], ...extra }] })
    expect(errorsOf(inc({ payDays: [] }))).toContain('al menos un día')
    expect(errorsOf(inc({ payDays: [15, 45] }))).toContain('del 1 al 31')
    expect(errorsOf(inc({ covers: ['luna'] }))).toContain('covers')
    expect(errorsOf(inc({ amount: -5 }))).toContain('monto inválido')
  })

  it('ajustes fuera de rango', () => {
    expect(errorsOf({ ...fixturePlan(), settings: { cutDay: 50 } })).toContain('cutDay')
    expect(errorsOf({ ...fixturePlan(), settings: { cashWithdrawalParts: 0 } })).toContain('cashWithdrawalParts')
  })

  it('limita la lista de errores para no inundar la pantalla', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, medio: 'banco', name: 'n', amount: 1 }))
    const { errors } = validatePlanInput({ lines })
    expect(errors).toHaveLength(9)
    expect(errors[8]).toBe('…y 12 problema(s) más.')
  })

  it('si hay un solo problema, no importa nada', () => {
    const input = fixturePlan()
    input.lines[3].amount = 'abc'
    expect(validatePlanInput(input)).toMatchObject({ ok: false, plan: null })
  })
})

// Plan real (opcional): solo corre si existe budget-seed.json en esta máquina.
// Comprueba invariantes de TU tabla sin escribir tus cifras en el código.
const seedPath = resolve(process.cwd(), 'budget-seed.json')
describe.skipIf(!existsSync(seedPath))('importar el plan real (budget-seed.json, local)', () => {
  const seed = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : null

  it('el archivo es un plan importable', () => {
    const result = validatePlanInput(seed)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.plan.lines).toHaveLength(seed.lines.length)
    expect(result.plan.incomes).toHaveLength(seed.incomes.length)
  })

  it('conserva el orden de tu tabla', () => {
    const { plan } = validatePlanInput(seed)
    expect(plan.lines.map((l) => l.id)).toEqual(seed.lines.map((l) => l.id))
  })

  it('el plan importado cuadra', () => {
    const { plan } = validatePlanInput(seed)
    expect(checkBalance(plan).balanced).toBe(true)
  })

  it('sobrevive exportar → importar → guardar → leer', () => {
    const { plan } = validatePlanInput(seed)
    const reimported = validatePlanInput(JSON.stringify(planToExport(plan))).plan
    expect(reimported).toEqual(plan)
    const stored = rtdbLike(JSON.parse(JSON.stringify(planToTree(plan))))
    expect(normalizePlan(stored)).toEqual(plan)
  })
})
