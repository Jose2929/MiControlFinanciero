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
})
