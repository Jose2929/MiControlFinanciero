import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BudgetPlan from './BudgetPlan'
import { BudgetContext } from '../context/BudgetContext'
import { FinanceContext } from '../context/FinanceContext'
import { createEmptyPlan } from '../lib/budget'
import { normalizePlan } from '../lib/budgetPlan'
import { fixtureAccounts, fixturePlan } from '../lib/budgetFixtures'

const noop = () => {}

function render(overrides = {}, mutate, accounts = fixtureAccounts()) {
  const plan = normalizePlan(fixturePlan())
  if (mutate) mutate(plan)
  const value = {
    status: 'ready',
    plan,
    hasPlan: true,
    writeError: null,
    clearWriteError: noop,
    updateSettings: noop,
    saveLine: noop,
    removeLine: noop,
    saveIncome: noop,
    removeIncome: noop,
    setAccountMedios: noop,
    importPlan: noop,
    ...overrides,
  }
  return renderToStaticMarkup(
    <FinanceContext.Provider value={{ accounts }}>
      <BudgetContext.Provider value={value}>
        <BudgetPlan />
      </BudgetContext.Provider>
    </FinanceContext.Provider>
  )
}

describe('Plan — plan que cuadra', () => {
  const html = render()

  it('muestra que cuadra y el restante en cero', () => {
    expect(html).toContain('Cuadra')
    expect(html).toContain('Restante')
    expect(html).not.toContain('No cuadra')
    expect(html).toContain('Persona A')
    expect(html).toContain('$20,000 − $20,000 =') // ingreso − asignado = restante
  })

  it('confirma que lo retenido de los sueldos paga la TDC', () => {
    expect(html).toContain('Lo retenido de tus sueldos paga la TDC completa ($12,000)')
  })

  it('muestra los cinco medios con su subtotal', () => {
    for (const label of ['TDC', 'TDC2', 'Débito', 'Efectivo', 'Ahorro']) {
      expect(html).toContain(`Agregar a ${label}`)
    }
    expect(html).toContain('$12,000') // TDC
    expect(html).toContain('$4,000') // Débito
    expect(html).toContain('$6,000') // Ahorro
  })

  it('muestra los bolsillos con lo que juntan al año', () => {
    expect(html).toContain('Anual · $4,800 al año')
    expect(html).toContain('Semestral · $1,200 al año · cobro de $600')
    expect(html).toContain('Fondo general · sin cobro propio')
    expect(html).toContain('Entre todos los bolsillos juntas $6,000 al año')
  })

  it('marca la válvula y el día de cargo', () => {
    expect(html).toContain('Válvula')
    expect(html).toContain('Cargo el día 3')
  })

  it('muestra los ingresos y las fechas del ciclo', () => {
    expect(html).toContain('Se paga el 15 y 30')
    expect(html).toContain('cubre TDC, TDC2, Débito, Efectivo')
    expect(html).toContain('Ciclo actual:')
    expect(html).toContain('Fecha límite de pago de la TDC')
  })

  it('ofrece exportar e importar, y no abre ningún modal por sí sola', () => {
    expect(html).toContain('Exportar plan')
    expect(html).toContain('Importar plan')
    expect(html).not.toContain('role="dialog"')
  })
})

describe('Plan — cuentas de la app', () => {
  it('lista cada cuenta con su tipo y los últimos 4 dígitos', () => {
    const html = render()
    expect(html).toContain('Cuentas de la app')
    expect(html).toContain('Tarjeta A')
    expect(html).toContain('Crédito · ••1234')
    expect(html).toContain('Medio de Tarjeta A')
    expect(html).toContain('Fuera del presupuesto')
  })

  it('con cuentas sin asignar ofrece sugerir, solo cuando no hay duda', () => {
    // Tarjeta A (única de crédito), Débito A (única de débito, no es TDC2) y
    // Efectivo (único) → 3 sugerencias.
    expect(render()).toContain('Sugerir (3)')
  })

  it('marca la cuenta ya asignada y no vuelve a sugerirla', () => {
    const html = render({}, (plan) => {
      plan.accountMedios = { 'acc-cred': 'tdc', 'acc-deb': 'debito', 'acc-cash': 'efectivo' }
    })
    expect(html).not.toContain('Sugerir (')
    expect(html).toMatch(/<option value="tdc" selected="">TDC<\/option>/)
  })

  it('avisa qué medios aún no tienen cuenta', () => {
    const html = render({}, (plan) => {
      plan.accountMedios = { 'acc-cred': 'tdc', 'acc-deb': 'debito', 'acc-cash': 'efectivo' }
    })
    expect(html).toContain('Aún no hay una cuenta para: TDC2, Ahorro')
  })

  it('sin cuentas registradas lo dice', () => {
    expect(render({}, undefined, [])).toContain('Aún no tienes cuentas registradas')
  })
})

describe('Plan — plan que no cuadra', () => {
  it('avisa cuánto te pasaste', () => {
    const html = render({}, (plan) => {
      plan.lines.find((l) => l.id === 'sobre-d1').amount += 250
    })
    expect(html).toContain('No cuadra')
    expect(html).toContain('Te pasaste por')
    expect(html).toContain('$250')
  })

  it('avisa cuánto queda sin asignar', () => {
    const html = render({}, (plan) => {
      plan.lines = plan.lines.filter((l) => l.id !== 'valvula')
    })
    expect(html).toContain('No cuadra')
    expect(html).toContain('Sin asignar')
    expect(html).toContain('sobran $1,000')
  })

  it('avisa si lo retenido no alcanza para la TDC', () => {
    const html = render({}, (plan) => {
      plan.lines.find((l) => l.id === 'cargo-1').amount += 500
    })
    expect(html).toContain('no alcanza para la TDC: faltan $500')
  })

  it('avisa si el día de reparto no es día de pago', () => {
    const html = render({}, (plan) => {
      plan.settings.spendTransferDay = 10
    })
    expect(html).toContain('no es un día de pago')
  })
})

describe('Plan — otros estados', () => {
  it('sin ingresos pide agregarlos en vez de mostrar un restante absurdo', () => {
    const html = render({}, (plan) => {
      plan.incomes = []
    })
    expect(html).toContain('Agrega tus ingresos para comprobar')
    expect(html).not.toContain('Te pasaste por')
  })

  it('cargando', () => {
    expect(render({ status: 'loading' })).toContain('Cargando el plan')
  })

  it('Firebase rechaza la lectura: explica el paso pendiente y muestra la regla', () => {
    const html = render({ status: 'denied' })
    expect(html).toContain('Falta un paso en Firebase')
    expect(html).toContain('&quot;budget&quot;')
    expect(html).not.toContain('Cuadra')
  })

  it('error de carga', () => {
    expect(render({ status: 'error' })).toContain('No se pudo cargar el plan')
  })

  it('sin plan: invita a importarlo o armarlo a mano', () => {
    const html = render({ hasPlan: false, plan: createEmptyPlan() })
    expect(html).toContain('Aún no hay un plan')
    expect(html).toContain('Importar plan (JSON)')
    expect(html).toContain('Armarlo a mano')
    expect(html).not.toContain('Verificación del plan')
  })

  it('muestra el aviso cuando falla un guardado', () => {
    const html = render({ writeError: 'No se pudo guardar el cambio.' })
    expect(html).toContain('No se pudo guardar el cambio.')
    expect(html).toContain('Cerrar aviso')
  })
})
