import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdjustEnvelopeModal } from './AdjustEnvelopeModal'
import { BudgetContext } from '../../context/BudgetContext'
import { FinanceContext } from '../../context/FinanceContext'
import { normalizePlan } from '../../lib/budgetPlan'
import { line } from '../../lib/budgetFixtures'

const noop = () => {}

const plan = (extra = {}) =>
  normalizePlan({
    settings: { startCycle: '2026-11' },
    accountMedios: { 'acc-deb': 'debito' },
    lines: [line('d-mand', 'debito', 'sobre', 1500, { name: 'Mandado' })],
    ...extra,
  })

const item = { line: plan().lines[0], balance: 1300, assigned: 1500, spent: 200, adjusted: 0, opening: 0 }

function render(props, budgetPlan = plan()) {
  return renderToStaticMarkup(
    <FinanceContext.Provider value={{ accounts: [{ id: 'acc-deb', name: 'Débito A', type: 'debito' }], addExpense: noop }}>
      <BudgetContext.Provider value={{ plan: budgetPlan, addAdjustment: noop, removeAdjustment: noop }}>
        <AdjustEnvelopeModal onClose={noop} {...props} />
      </BudgetContext.Provider>
    </FinanceContext.Provider>
  )
}

describe('AdjustEnvelopeModal', () => {
  it('sin sobre no muestra nada', () => {
    expect(render({ item: null })).toBe('')
  })

  it('muestra lo que dice la app y pide lo que hay de verdad', () => {
    const html = render({ item })
    expect(html).toContain('Ajustar Mandado')
    expect(html).toContain('Según la app tiene')
    expect(html).toContain('$1,300')
    expect(html).toContain('¿Cuánto tiene realmente?')
  })

  it('en un ciclo cerrado pregunta con cuánto cerró, no cuánto tiene hoy', () => {
    const html = render({ item, phase: 'past', date: '2020-10-31' })
    expect(html).toContain('Según la app cerró con')
    expect(html).toContain('¿Con cuánto cerró realmente?')
    expect(html).not.toContain('¿Cuánto tiene realmente?')
  })

  it('en el ciclo en curso mantiene las preguntas de siempre', () => {
    const html = render({ item })
    expect(html).toContain('Según la app tiene')
    expect(html).toContain('¿Cuánto tiene realmente?')
  })

  it('sin escribir nada todavía no ofrece qué hacer con la diferencia ni deja enviar', () => {
    const html = render({ item })
    expect(html).not.toContain('¿Qué hacemos con la diferencia?')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/)
  })

  it('sin ajustes anteriores no muestra el historial', () => {
    expect(render({ item })).not.toContain('Ajustes anteriores')
  })

  it('muestra los ajustes anteriores de ese sobre, con su monto con signo y cómo quitarlos', () => {
    const p = plan({
      adjustments: [
        { id: 'a1', envelopeId: 'd-mand', amount: -320, date: '2026-11-10', note: 'Se me olvidó el súper' },
        { id: 'a2', envelopeId: 'otro-sobre', amount: 50, date: '2026-11-11', note: 'De otro sobre' },
      ],
    })
    const html = render({ item }, p)
    expect(html).toContain('Ajustes anteriores de este sobre')
    expect(html).toContain('Se me olvidó el súper')
    expect(html).toContain('−$320')
    expect(html).toContain('Quitar ajuste')
    expect(html).not.toContain('De otro sobre')
  })

  it('solo enseña los 5 ajustes más recientes', () => {
    const adjustments = Array.from({ length: 8 }, (_, i) => ({
      id: `a${i}`,
      envelopeId: 'd-mand',
      amount: -(i + 1),
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      note: `Conteo ${i + 1}`,
    }))
    const html = render({ item }, plan({ adjustments }))
    expect((html.match(/aria-label="Quitar ajuste"/g) || []).length).toBe(5)
    expect(html).toContain('Conteo 8')
    expect(html).not.toContain('Conteo 1<')
  })
})
