import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import BudgetEnvelopes from './BudgetEnvelopes'
import { BudgetContext } from '../context/BudgetContext'
import { FinanceContext } from '../context/FinanceContext'
import { createEmptyPlan, getCycleForDate } from '../lib/budget'
import { normalizePlan } from '../lib/budgetPlan'
import { line } from '../lib/budgetFixtures'

const noop = () => {}

// El presupuesto "arranca" en el ciclo de hoy: así nada depende del día en que
// se corran las pruebas (arrastre 0, y las operaciones de hoy caen en el ciclo).
const startKey = getCycleForDate(new Date(), 1).key

function makePlan(extra = {}) {
  return normalizePlan({
    settings: { cycleStartDay: 1, startCycle: startKey },
    accountMedios: { 'acc-deb': 'debito', 'acc-cash': 'efectivo', 'acc-t2': 'tdc2' },
    lines: [
      line('d-mand', 'debito', 'sobre', 1500, { name: 'Mandado' }),
      line('d-ocio', 'debito', 'sobre', 600, { name: 'Entretenimiento' }),
      line('c-croq', 'efectivo', 'sobre', 300, { name: 'Croquetas' }),
      line('fondo', 'tdc2', 'fondo', 500, { payFrequency: null, name: 'Fondo' }),
      line('bol-anual', 'tdc2', 'bolsillo', 400, { payFrequency: 'anual', name: 'Bolsillo Anual' }),
      line('cargo', 'tdc', 'cargo', 100, { name: 'Un cargo' }),
    ],
    ...extra,
  })
}

let seq = 0
const tx = (envelopeId, amount, extra = {}) => ({
  id: `t${(seq += 1)}`,
  type: 'expense',
  amount,
  envelopeId,
  accountId: 'acc-deb',
  categoryId: 'comida',
  note: 'Gasto',
  date: new Date(),
  ...extra,
})

const accounts = [
  { id: 'acc-deb', name: 'Débito A', type: 'debito' },
  { id: 'acc-cash', name: 'Efectivo', type: 'efectivo' },
  { id: 'acc-t2', name: 'TDC2', type: 'debito' },
]

function render({ plan = makePlan(), transactions = [], budget = {} } = {}) {
  const budgetValue = {
    status: 'ready',
    plan,
    hasPlan: true,
    updateSettings: noop,
    ...budget,
  }
  const financeValue = {
    transactions,
    accounts,
    findCategory: (id) => ({ id, label: { comida: 'Comida' }[id] || id }),
    updateTransaction: noop,
  }
  return renderToStaticMarkup(
    <StaticRouter location="/presupuesto">
      <FinanceContext.Provider value={financeValue}>
        <BudgetContext.Provider value={budgetValue}>
          <BudgetEnvelopes />
        </BudgetContext.Provider>
      </FinanceContext.Provider>
    </StaticRouter>
  )
}

describe('Sobres — con el presupuesto en marcha', () => {
  const html = render({ transactions: [tx('d-mand', 200)] })

  it('muestra el resumen y los cuatro grupos', () => {
    expect(html).toContain('Disponible en sobres')
    for (const title of ['Débito', 'Efectivo', 'Fondo general', 'Bolsillos de TDC2']) {
      expect(html).toContain(title)
    }
  })

  it('muestra cada sobre y bolsillo, pero no los cargos de la TDC', () => {
    for (const name of ['Mandado', 'Entretenimiento', 'Croquetas', 'Fondo', 'Bolsillo Anual']) {
      expect(html).toContain(name)
    }
    expect(html).not.toContain('Un cargo')
  })

  it('un sobre muestra lo gastado frente a lo asignado y lo que queda', () => {
    expect(html).toContain('Gastado $200 de $1,500')
    expect(html).toContain('$1,300') // 1500 − 200
  })

  it('el ciclo actual muestra el ritmo y el aproximado por semana', () => {
    expect(html).toMatch(/Día \d+ de \d+/)
    expect(html).toContain('por semana')
    expect(html).toMatch(/por (encima|debajo) del ritmo|Justo en el ritmo/)
  })

  it('el bolsillo muestra la meta del cobro y cuánto falta', () => {
    expect(html).toContain('Meta del cobro $4,800 · faltan $4,400')
  })

  it('el resumen suma lo asignado y lo gastado de los sobres de gasto (sin bolsillos)', () => {
    // 1500 + 600 + 300 + 500 = 2900 asignado; 200 gastado
    expect(html).toContain('Asignado del ciclo $2,900 · Gastado $200')
  })

  it('arranca en el primer ciclo: no hay a dónde regresar, ni a dónde avanzar', () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Ciclo anterior"/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Ciclo siguiente"/)
  })
})

describe('Sobres — gastos sin sobre', () => {
  it('lista los gastos sin sobre y ofrece el sobre sugerido', () => {
    const html = render({
      transactions: [
        tx('d-mand', 100, { id: 'ya-asignado' }), // historial: Comida → Mandado
        tx(undefined, 50, { id: 'pendiente', note: 'Tortillas' }),
      ],
    })
    expect(html).toContain('Gastos sin sobre')
    expect(html).toContain('Tortillas')
    expect(html).toContain('Elegir sobre…')
    expect(html).toContain('Usar Mandado')
    expect(html).toContain('Usar sugeridos (1)')
  })

  it('sin sugerencia posible, solo ofrece elegir', () => {
    const html = render({ transactions: [tx(undefined, 50, { categoryId: 'otros' })] })
    expect(html).toContain('Gastos sin sobre')
    expect(html).not.toContain('Usar sugeridos')
    expect(html).not.toMatch(/Usar (Mandado|Entretenimiento)/)
  })

  it('con todo asignado, la tarjeta no aparece', () => {
    expect(render({ transactions: [tx('d-mand', 100)] })).not.toContain('Gastos sin sobre')
  })

  it('un pago de tarjeta no se pide ni cuenta', () => {
    const html = render({ transactions: [tx(undefined, 900, { counterAccountId: 'acc-tdc' })] })
    expect(html).not.toContain('Gastos sin sobre')
    expect(html).toContain('Gastado $0 de $1,500')
  })
})

describe('Sobres — sobregiro y avisos', () => {
  it('avisa cuando un sobre ya se pasó de lo disponible', () => {
    const html = render({ transactions: [tx('d-ocio', 1000)] })
    expect(html).toContain('Ya te pasaste de lo disponible')
  })

  it('avisa si no hay cuentas ligadas a un medio', () => {
    const html = render({ plan: makePlan({ accountMedios: {} }) })
    expect(html).toContain('Todavía no hay cuentas ligadas a un medio')
  })

  it('con las cuentas ligadas no muestra ese aviso', () => {
    expect(render()).not.toContain('Todavía no hay cuentas ligadas')
  })
})

describe('Sobres — otros estados', () => {
  it('sin ciclo de arranque lo pide, con las dos opciones, y no muestra saldos', () => {
    const html = render({ plan: makePlan({ settings: { startCycle: null } }) })
    expect(html).toContain('Un paso antes de empezar')
    expect(html).toContain('¿Desde qué ciclo cuenta el presupuesto?')
    expect(html).toContain('Empezar en el ciclo actual')
    expect(html).toContain('Empezar en el siguiente')
    expect(html).not.toContain('Disponible en sobres')
  })

  it('sin plan, manda a armarlo', () => {
    const html = render({ plan: createEmptyPlan(), budget: { hasPlan: false } })
    expect(html).toContain('Primero arma tu plan')
    expect(html).toContain('Ir a Plan')
  })

  it('un plan sin sobres lo explica', () => {
    const html = render({ plan: makePlan({ lines: [line('cargo', 'tdc', 'cargo', 100)] }) })
    expect(html).toContain('Tu plan aún no tiene sobres')
  })

  it('cargando', () => {
    expect(render({ budget: { status: 'loading' } })).toContain('Cargando los sobres')
  })

  it('Firebase rechaza la lectura: explica el paso pendiente', () => {
    expect(render({ budget: { status: 'denied' } })).toContain('Falta un paso en Firebase')
  })

  it('error de carga', () => {
    expect(render({ budget: { status: 'error' } })).toContain('No se pudieron cargar los sobres')
  })
})
