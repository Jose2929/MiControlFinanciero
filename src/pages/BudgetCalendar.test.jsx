import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import BudgetCalendar from './BudgetCalendar'
import { BudgetContext } from '../context/BudgetContext'
import { createEmptyPlan } from '../lib/budget'
import { normalizePlan } from '../lib/budgetPlan'
import { buildMonthEvents, countChecks } from '../lib/budgetCalendar'
import { fixturePlan } from '../lib/budgetFixtures'

const noop = () => {}
const TODAY = new Date(2026, 11, 15) // 15 de diciembre de 2026

const makePlan = (extra = {}) => {
  const base = fixturePlan()
  return normalizePlan({ ...base, settings: { ...base.settings, cutDay: 12, payDueDay: 3 }, ...extra })
}

function render({ plan = makePlan(), budget = {}, today = TODAY } = {}) {
  const value = { status: 'ready', plan, hasPlan: true, setCheck: noop, ...budget }
  return renderToStaticMarkup(
    <StaticRouter location="/presupuesto/calendario">
      <BudgetContext.Provider value={value}>
        <BudgetCalendar today={today} />
      </BudgetContext.Provider>
    </StaticRouter>
  )
}

const dayButton = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}[^"]*"[^>]*>`))?.[0] || ''

describe('Calendario — el mes', () => {
  const html = render()

  it('muestra el mes y permite ir al anterior y al siguiente', () => {
    expect(html).toContain('Diciembre de 2026')
    expect(html).toContain('aria-label="Mes anterior"')
    expect(html).toContain('aria-label="Mes siguiente"')
    expect(html).not.toContain('Volver a hoy')
  })

  it('dibuja todos los días del mes', () => {
    for (let day = 1; day <= 31; day += 1) {
      expect(dayButton(html, `${day} de diciembre`), `día ${day}`).not.toBe('')
    }
    expect(dayButton(html, '32 de diciembre')).toBe('')
  })

  it('el 1 de diciembre de 2026 es martes: hay dos espacios antes del primer día', () => {
    // Domingo primero: D, L en blanco y el 1 cae en M.
    expect((html.match(/aria-hidden="true"/g) || []).length).toBeGreaterThan(0)
    expect(new Date(2026, 11, 1).getDay()).toBe(2)
  })

  it('cada día dice qué tiene, con los nombres de los iconos', () => {
    expect(dayButton(html, '15 de diciembre')).toContain('Sueldo, Transferencia, Gasto programado')
    expect(dayButton(html, '3 de diciembre')).toContain('Pago de la TDC, Cargo a la TDC')
    expect(dayButton(html, '12 de diciembre')).toContain('Corte de la TDC')
    expect(dayButton(html, '1 de diciembre')).toContain('Ahorro')
    expect(dayButton(html, '2 de diciembre')).toContain('aria-label="2 de diciembre"') // un día sin nada: sin lista
  })

  it('marca el día de hoy y deja elegido ese día', () => {
    expect(dayButton(html, '15 de diciembre')).toContain('aria-current="date"')
    expect(dayButton(html, '15 de diciembre')).toContain('aria-pressed="true"')
    expect(dayButton(html, '16 de diciembre')).toContain('aria-pressed="false"')
  })

  it('explica los iconos con una leyenda', () => {
    expect(html).toContain('Qué significa cada icono')
    for (const label of ['Sueldo', 'Transferencia', 'Pago de la TDC', 'Cargo a la TDC', 'Gasto programado', 'Ahorro', 'Corte de la TDC']) {
      expect(html).toContain(label)
    }
  })

  it('resume lo que entra, el pago de la TDC y el ahorro del mes', () => {
    expect(html).toContain('Este mes')
    expect(html).toMatch(/Entra<\/dt><dd[^>]*>\$26,000/)
    expect(html).toMatch(/Pago TDC<\/dt><dd[^>]*>\$12,000/)
    expect(html).toMatch(/A ahorro<\/dt><dd[^>]*>\$6,000/)
  })
})

describe('Calendario — detalle del día', () => {
  it('el día elegido lista sus eventos con monto y su palomita', () => {
    const html = render()
    expect(html).toContain('Sueldo de Persona A')
    expect(html).toContain('+$10,000')
    expect(html).toContain('Pasar a TDC2')
    expect(html).toContain('Pasar al Débito para el efectivo')
    expect(html).toContain('Se retira en 2 partes: $1,500 + $1,500')
    expect(html).toContain('aria-label="Marcar Sueldo de Persona A"')
  })

  it('el corte no tiene palomita (no es algo que se haga)', () => {
    // Se ve en el detalle al tener elegido el 12 de diciembre.
    const html = render({ today: new Date(2026, 11, 12) })
    expect(html).toContain('Corte de la TDC')
    expect(html).toContain('Cierra el estado de cuenta')
    expect(html).not.toContain('aria-label="Marcar Corte de la TDC"')
  })

  it('el pago de la TDC dice de qué corte viene', () => {
    const html = render({ today: new Date(2026, 11, 3) })
    expect(html).toContain('Pago de la TDC')
    expect(html).toContain('Estado con corte del 12 de noviembre')
    expect(html).toContain('$12,000')
  })

  it('un día sin nada lo dice', () => {
    expect(render({ today: new Date(2026, 11, 2) })).toContain('No hay nada programado este día.')
  })

  it('las palomitas arrancan sin marcar', () => {
    const html = render()
    expect(html).toContain('aria-checked="false"')
    expect(html).not.toContain('aria-checked="true"')
    expect(html).toContain('0 de ')
  })
})

describe('Calendario — palomitas', () => {
  const calendar = buildMonthEvents(makePlan(), 2026, 11)
  const checks = { ing_a_15: true, trf_15_tdc2: true }
  const plan = makePlan({ checks: { '2026-12': checks, '2026-11': { ing_a_30: true } } })
  const html = render({ plan })

  it('muestra marcado lo que ya se hizo en ese mes', () => {
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Marcar Sueldo de Persona A"/)
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Marcar Pasar a TDC2"/)
    expect(html).toMatch(/aria-checked="false"[^>]*aria-label="Marcar Pasar al Débito"/)
  })

  it('cuenta cuántas van marcadas del mes (no las de otro mes)', () => {
    const { total } = countChecks(calendar.events, {})
    expect(html).toContain(`2 de ${total} marcados`)
  })

  it('lo marcado se ve tachado', () => {
    expect(html).toMatch(/line-through[^>]*>Sueldo de Persona A/)
  })

  it('con todo marcado, el día se ve listo y el mes completo', () => {
    const all = Object.fromEntries(calendar.events.filter((e) => e.checkable).map((e) => [e.key, true]))
    const done = render({ plan: makePlan({ checks: { '2026-12': all } }) })
    const { total } = countChecks(calendar.events, {})
    expect(done).toContain(`${total} de ${total} marcados`)
    expect(dayButton(done, '15 de diciembre')).toContain('(todo marcado)')
  })

  it('sin permiso para escribir, las palomitas se bloquean', () => {
    const html2 = render({ budget: { status: 'denied' } })
    expect(html2).toContain('Falta un paso en Firebase')
  })
})

describe('Calendario — otros estados', () => {
  it('sin plan, manda a armarlo', () => {
    const html = render({ plan: createEmptyPlan(), budget: { hasPlan: false } })
    expect(html).toContain('Primero arma tu plan')
    expect(html).toContain('Ir a Plan')
  })

  it('cargando', () => {
    expect(render({ budget: { status: 'loading' } })).toContain('Cargando el calendario')
  })

  it('error de carga', () => {
    expect(render({ budget: { status: 'error' } })).toContain('No se pudo cargar el calendario')
  })

  it('un plan sin nada programado muestra el mes vacío sin romperse', () => {
    const html = render({ plan: makePlan({ incomes: [], lines: [{ id: 'f', medio: 'tdc2', kind: 'fondo', name: 'Fondo', amount: 10, payDay: null, payFrequency: null }] }) })
    expect(html).toContain('0 de 0 marcados')
    expect(html).toContain('No hay nada programado este día.')
  })
})
