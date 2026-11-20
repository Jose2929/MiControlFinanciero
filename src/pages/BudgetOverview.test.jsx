import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import BudgetOverview from './BudgetOverview'
import { BudgetContext } from '../context/BudgetContext'
import { FinanceContext } from '../context/FinanceContext'
import { createEmptyPlan } from '../lib/budget'
import { normalizePlan } from '../lib/budgetPlan'
import { fixturePlan } from '../lib/budgetFixtures'

const TODAY = new Date(2026, 11, 15) // 15 de diciembre de 2026

const makePlan = ({ startCycle = '2026-12', ...extra } = {}) => {
  const base = fixturePlan()
  return normalizePlan({
    ...base,
    settings: { ...base.settings, startCycle },
    accountMedios: { 'acc-deb': 'debito' },
    ...extra,
  })
}

const expense = (amount, envelopeId) => ({
  id: `t-${envelopeId}`,
  type: 'expense',
  amount,
  envelopeId,
  accountId: 'acc-deb',
  categoryId: 'comida',
  note: 'Gasto',
  date: new Date(2026, 11, 10),
})

function render({ plan = makePlan(), budget = {}, transactions = [], today = TODAY } = {}) {
  return renderToStaticMarkup(
    <StaticRouter location="/presupuesto">
      <FinanceContext.Provider value={{ transactions }}>
        <BudgetContext.Provider value={{ status: 'ready', plan, hasPlan: true, ...budget }}>
          <BudgetOverview today={today} />
        </BudgetContext.Provider>
      </FinanceContext.Provider>
    </StaticRouter>
  )
}

describe('Resumen — cada mes', () => {
  const html = render()

  it('dice cuánto entra', () => {
    expect(html).toContain('Cada mes entra')
    expect(html).toContain('$26,000')
  })

  it('reparte entre tarjeta, digital, efectivo y ahorro, con monto y porcentaje', () => {
    for (const label of ['Tarjeta de crédito', 'Digital', 'Efectivo', 'Ahorro']) expect(html).toContain(label)
    for (const amount of ['$12,000', '$5,000', '$3,000', '$6,000']) expect(html).toContain(amount)
    for (const percent of ['46%', '19%', '12%', '23%']) expect(html).toContain(percent)
  })

  it('digital dice cuánto es de débito y cuánto de TDC2', () => {
    expect(html).toContain('Débito $4,000 · TDC2 $1,000')
  })

  it('la barra describe el reparto', () => {
    expect(html).toMatch(/role="img" aria-label="Reparto del mes: Tarjeta de crédito 46%, Digital 19%, Efectivo 12%, Ahorro 23%"/)
  })

  it('dice cuánto es de sobres de gasto diario (débito + efectivo)', () => {
    expect(html).toContain('Sobres de gasto diario')
    expect(html).toContain('$7,000')
  })

  it('un plan que cuadra lo dice y no manda a ajustar', () => {
    expect(html).toContain('Todo asignado')
    expect(html).not.toContain('Ajustar en Plan')
  })

  it('si falta asignar, lo dice y manda a Plan', () => {
    const p = makePlan({ incomes: [{ id: 'a', name: 'A', amount: 40000, payDays: [15], covers: ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro'] }] })
    const h = render({ plan: p })
    expect(h).toContain('Faltan por asignar $14,000')
    expect(h).toContain('Ajustar en Plan')
    expect(h).not.toContain('Todo asignado')
  })

  it('si se asigna de más, también lo dice', () => {
    const p = makePlan({ incomes: [{ id: 'a', name: 'A', amount: 10000, payDays: [15], covers: ['tdc', 'tdc2', 'debito', 'efectivo', 'ahorro'] }] })
    expect(render({ plan: p })).toContain('Asignas $16,000 de más')
  })
})

describe('Resumen — lo que tienes ahora', () => {
  it('separa digital y efectivo con lo gastado ya descontado', () => {
    const html = render({ transactions: [expense(200, 'sobre-d1')] })
    expect(html).toContain('Lo que tienes ahora')
    expect(html).toContain('$7,800') // 3,800 débito + 500 fondo + 500 bolsillos + 3,000 efectivo
    expect(html).toContain('Débito $3,800 · Fondo general $500 · Bolsillos $500')
    expect(html).toContain('Ciclo en curso')
    expect(html).toContain('Ver sobres')
  })

  it('en un ciclo que aún no empieza lo dice y muestra lo que arranca', () => {
    const html = render({ plan: makePlan({ startCycle: '2027-01' }) })
    expect(html).toContain('Aún no empieza')
    expect(html).toContain('$8,000') // débito 4,000 + fondo 500 + bolsillos 500 + efectivo 3,000
  })

  it('sin ciclo de arranque manda a Sobres para elegirlo', () => {
    const html = render({ plan: makePlan({ startCycle: null }) })
    expect(html).toContain('Elígelo en Sobres')
    expect(html).not.toContain('en sobres y bolsillos')
  })
})

describe('Resumen — qué hay en cada cosa', () => {
  const html = render()

  it('un bloque por medio, con total, cuántos renglones y su parte del mes', () => {
    expect(html).toContain('Qué hay en cada cosa')
    for (const title of ['Sobres de Débito', 'Sobres de Efectivo', 'Fondo y bolsillos (TDC2)', 'Tarjeta de crédito', 'Ahorro']) {
      expect(html).toContain(title)
    }
    expect(html).toContain('3 cargos · 46% del mes')
    expect(html).toContain('2 sobres · 15% del mes') // débito 4,000 / 26,000
  })

  it('cada bloque es desplegable y trae sus renglones', () => {
    expect((html.match(/<details/g) || []).length).toBe(5)
    expect(html).toContain('cargo-1')
    expect(html).toContain('$7,000')
    expect(html).toContain('Día 3')
    expect(html).toContain('Día 5 · válvula del plan')
    expect(html).toContain('Cobro anual')
  })

  it('un plan sin renglones no muestra la lista', () => {
    const p = makePlan({ lines: [], incomes: [] })
    const h = render({ plan: p, budget: { hasPlan: true } })
    expect(h).not.toContain('Qué hay en cada cosa')
  })
})

describe('Resumen — otros estados', () => {
  it('sin plan, manda a armarlo', () => {
    const html = render({ plan: createEmptyPlan(), budget: { hasPlan: false } })
    expect(html).toContain('Primero arma tu plan')
    expect(html).toContain('Ir a Plan')
  })

  it('cargando', () => {
    expect(render({ budget: { status: 'loading' } })).toContain('Cargando el resumen')
  })

  it('Firebase rechaza la lectura: explica el paso pendiente', () => {
    expect(render({ budget: { status: 'denied' } })).toContain('Falta un paso en Firebase')
  })

  it('error de carga', () => {
    expect(render({ budget: { status: 'error' } })).toContain('No se pudo cargar el resumen')
  })
})
