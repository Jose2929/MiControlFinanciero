import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { BottomNav } from './BottomNav'
import { ModeSwitch } from './ModeSwitch'
import {
  BOTTOM_NAV_ITEMS,
  BUDGET_NAV_ITEMS,
  NAV_ITEMS,
  MODE_HOME,
  getAppMode,
  getPageTitle,
} from '../../lib/nav'

function render(ui, path) {
  return renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>)
}

const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) || []
const anchorFor = (html, href) => tags(html, 'a').find((t) => t.includes(`href="${href}"`))
const isActive = (html, href) => Boolean(anchorFor(html, href)?.includes('aria-current="page"'))
const activeHrefs = (html) =>
  tags(html, 'a')
    .filter((t) => t.includes('aria-current="page"'))
    .map((t) => t.match(/href="([^"]+)"/)?.[1])

// [[seleccionado, etiqueta], ...] de las pestañas del selector.
const switchTabs = (html) =>
  [...html.matchAll(/<button[^>]*aria-selected="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]])

describe('getAppMode', () => {
  it('rutas del apartado Presupuesto', () => {
    expect(getAppMode('/presupuesto')).toBe('presupuesto')
    expect(getAppMode('/presupuesto/')).toBe('presupuesto')
    expect(getAppMode('/presupuesto/plan')).toBe('presupuesto')
    expect(getAppMode('/presupuesto/quincena')).toBe('presupuesto')
  })

  it('todo lo demás es Registro — incluido /presupuestos (límites por categoría)', () => {
    expect(getAppMode('/presupuestos')).toBe('registro')
    expect(getAppMode('/presupuesto-x')).toBe('registro')
    expect(getAppMode('/dashboard')).toBe('registro')
    expect(getAppMode('/gastos')).toBe('registro')
    expect(getAppMode('/')).toBe('registro')
    expect(getAppMode()).toBe('registro')
  })

  it('el inicio de cada apartado cae en su propio apartado', () => {
    for (const [mode, home] of Object.entries(MODE_HOME)) {
      expect(getAppMode(home)).toBe(mode)
    }
  })
})

describe('rutas y títulos', () => {
  it('cada pestaña de Presupuesto vive bajo /presupuesto y tiene título propio', () => {
    expect(BUDGET_NAV_ITEMS).toHaveLength(4)
    for (const item of BUDGET_NAV_ITEMS) {
      expect(getAppMode(item.to)).toBe('presupuesto')
      expect(getPageTitle(item.to)).not.toBe('Mi Control Financiero')
    }
  })

  it('ninguna ruta de Registro cae por error en Presupuesto', () => {
    for (const item of [...NAV_ITEMS, ...BOTTOM_NAV_ITEMS]) {
      expect(getAppMode(item.to)).toBe('registro')
    }
  })

  it('el título de /presupuestos (viejo) no cambió', () => {
    expect(getPageTitle('/presupuestos')).toBe('Presupuestos')
  })
})

describe('BottomNav', () => {
  it('en Registro muestra las 5 pestañas de siempre y ninguna de Presupuesto', () => {
    const html = render(<BottomNav />, '/gastos')
    for (const label of ['Inicio', 'Gastos', 'Presupuestos', 'Deudas', 'Perfil']) {
      expect(html).toContain(label)
    }
    for (const label of ['Sobres', 'Quincena', 'Calendario']) {
      expect(html).not.toContain(label)
    }
    expect(activeHrefs(html)).toEqual(['/gastos'])
  })

  it('en Presupuesto muestra sus 4 pestañas y ninguna de Registro', () => {
    const html = render(<BottomNav />, '/presupuesto/plan')
    for (const label of ['Sobres', 'Quincena', 'Calendario', 'Plan']) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain('Inicio')
    expect(html).not.toContain('Deudas')
    expect(activeHrefs(html)).toEqual(['/presupuesto/plan'])
  })

  it('"Sobres" solo se marca en /presupuesto exacto, no en sus subpantallas', () => {
    expect(isActive(render(<BottomNav />, '/presupuesto'), '/presupuesto')).toBe(true)
    expect(isActive(render(<BottomNav />, '/presupuesto/quincena'), '/presupuesto')).toBe(false)
    expect(isActive(render(<BottomNav />, '/presupuesto/quincena'), '/presupuesto/quincena')).toBe(true)
  })

  it('/presupuestos (el viejo) sigue en Registro con su pestaña activa', () => {
    const html = render(<BottomNav />, '/presupuestos')
    expect(html).toContain('Inicio')
    expect(html).not.toContain('Sobres')
    expect(activeHrefs(html)).toEqual(['/presupuestos'])
  })
})

describe('ModeSwitch', () => {
  it('marca Presupuesto dentro del apartado Presupuesto', () => {
    expect(switchTabs(render(<ModeSwitch />, '/presupuesto/quincena'))).toEqual([
      ['false', 'Registro'],
      ['true', 'Presupuesto'],
    ])
  })

  it('marca Registro en las pantallas de siempre', () => {
    expect(switchTabs(render(<ModeSwitch />, '/dashboard'))).toEqual([
      ['true', 'Registro'],
      ['false', 'Presupuesto'],
    ])
  })

  it('/presupuestos (el viejo) cuenta como Registro', () => {
    expect(switchTabs(render(<ModeSwitch />, '/presupuestos'))).toEqual([
      ['true', 'Registro'],
      ['false', 'Presupuesto'],
    ])
  })
})
