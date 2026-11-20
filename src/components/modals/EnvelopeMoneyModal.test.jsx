import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EnvelopeMoneyModal } from './EnvelopeMoneyModal'
import { BudgetContext } from '../../context/BudgetContext'
import { normalizePlan } from '../../lib/budgetPlan'
import { line } from '../../lib/budgetFixtures'

const noop = () => {}

const plan = (extra = {}) =>
  normalizePlan({
    settings: { startCycle: '2026-11' },
    lines: [line('d-mand', 'debito', 'sobre', 1500, { name: 'Mandado' })],
    ...extra,
  })

const item = { line: plan().lines[0], balance: 1300, assigned: 1500, spent: 200, adjusted: 0, opening: 0 }

function render(props, budgetPlan = plan()) {
  return renderToStaticMarkup(
    <BudgetContext.Provider value={{ plan: budgetPlan, addAdjustment: noop, removeAdjustment: noop }}>
      <EnvelopeMoneyModal onClose={noop} {...props} />
    </BudgetContext.Provider>
  )
}

describe('EnvelopeMoneyModal', () => {
  it('sin sobre no muestra nada', () => {
    expect(render({ item: null })).toBe('')
  })

  it('por defecto es para agregar: muestra lo que tiene hoy y qué hace', () => {
    const html = render({ item })
    expect(html).toContain('Agregar a Mandado')
    expect(html).toContain('Hoy tiene')
    expect(html).toContain('$1,300')
    expect(html).toContain('¿Cuánto agregas?')
    expect(html).toContain('sin tocar tus cuentas')
  })

  it('al sacar cambia el título, la pregunta y manda a "Gasto" si fue una compra', () => {
    const html = render({ item, direction: 'out' })
    expect(html).toContain('Sacar de Mandado')
    expect(html).toContain('¿Cuánto sacas?')
    expect(html).toContain('mejor usa &quot;Gasto&quot;')
  })

  it('las dos opciones están a la vista y la elegida está marcada', () => {
    const html = render({ item, direction: 'out' })
    expect(html).toMatch(/aria-pressed="false"[^>]*>Agregar</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Sacar</)
  })

  it('sin escribir un monto no deja enviar ni promete un saldo', () => {
    const html = render({ item })
    expect(html).not.toContain('Quedaría en')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/)
    expect(html).toContain('Agregar al sobre')
  })

  it('muestra el historial de ese sobre, con cómo deshacer', () => {
    const p = plan({
      adjustments: [{ id: 'a1', envelopeId: 'd-mand', amount: 250, date: '2026-11-10', note: 'Dinero agregado' }],
    })
    const html = render({ item }, p)
    expect(html).toContain('Ajustes anteriores de este sobre')
    expect(html).toContain('+$250')
    expect(html).toContain('aria-label="Quitar ajuste"')
  })

  it('en un ciclo futuro avisa con qué fecha se anota; en el ciclo en curso no dice nada', () => {
    const future = render({ item, date: '2099-01-01', phase: 'future' })
    expect(future).toContain('Se anota con fecha del')
    expect(future).toContain('cuando empieza este ciclo')
    expect(future).toContain('Hoy tiene')
    expect(render({ item })).not.toContain('Se anota con fecha')
    const today = new Date()
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(render({ item, date: todayValue, phase: 'current' })).not.toContain('Se anota con fecha')
  })

  it('en un ciclo cerrado habla de cómo cerró, anota el último día y avisa que se arrastra', () => {
    const html = render({ item, date: '2020-10-31', phase: 'past' })
    expect(html).toContain('Cerró con')
    expect(html).not.toContain('Hoy tiene')
    expect(html).toContain('el último día de este ciclo')
    expect(html).toContain('se arrastra a los ciclos siguientes')
  })
})
