import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './budget'
import { fixturePlan } from './budgetFixtures'
import {
  coerceSettingValue,
  isValidCycleKey,
  isValidSettingValue,
  normalizeLine,
  normalizePlan,
  normalizeSettings,
  planToExport,
  planToTree,
  validatePlanInput,
} from './budgetPlan'

describe('ciclo de arranque (startCycle)', () => {
  it('isValidCycleKey solo acepta AAAA-MM con mes 01 a 12', () => {
    for (const ok of ['2026-11', '2027-01', '1999-12']) expect(isValidCycleKey(ok)).toBe(true)
    for (const bad of ['2026-13', '2026-00', '26-11', '2026-1', '2026-11-01', '', null, undefined, 202611]) {
      expect(isValidCycleKey(bad)).toBe(false)
    }
  })

  it('por defecto no está elegido', () => {
    expect(DEFAULT_SETTINGS.startCycle).toBeNull()
    expect(normalizeSettings(undefined).startCycle).toBeNull()
  })

  it('se lee si es válido y se descarta si no', () => {
    expect(normalizeSettings({ startCycle: '2026-12' }).startCycle).toBe('2026-12')
    expect(normalizeSettings({ startCycle: '2026-99' }).startCycle).toBeNull()
    expect(normalizeSettings({ startCycle: 5 }).startCycle).toBeNull()
  })

  it('isValidSettingValue y coerceSettingValue lo tratan como texto, no como número', () => {
    expect(isValidSettingValue('startCycle', '2026-11')).toBe(true)
    expect(isValidSettingValue('startCycle', 'x')).toBe(false)
    expect(coerceSettingValue('startCycle', '2026-11')).toBe('2026-11')
    expect(coerceSettingValue('startCycle', 'x')).toBeUndefined()
    expect(coerceSettingValue('cutDay', '7')).toBe(7)
    expect(coerceSettingValue('cutDay', 99)).toBeUndefined()
    expect(coerceSettingValue('noExiste', 1)).toBeUndefined()
  })

  it('sin elegir, no se guarda: importar un plan no borra el arranque ya escogido', () => {
    const noStart = normalizePlan(fixturePlan())
    expect(planToTree(noStart).settings).not.toHaveProperty('startCycle')
    const withStart = normalizePlan({ ...fixturePlan(), settings: { ...fixturePlan().settings, startCycle: '2026-11' } })
    expect(planToTree(withStart).settings.startCycle).toBe('2026-11')
  })

  it('un archivo con un arranque mal formado se rechaza', () => {
    const input = { ...fixturePlan(), settings: { ...fixturePlan().settings, startCycle: 'noviembre' } }
    const result = validatePlanInput(input)
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('startCycle')
  })

  it('un archivo con arranque válido se importa y se exporta de vuelta', () => {
    const input = { ...fixturePlan(), settings: { ...fixturePlan().settings, startCycle: '2026-12' } }
    const result = validatePlanInput(input)
    expect(result.ok).toBe(true)
    expect(result.plan.settings.startCycle).toBe('2026-12')
    expect(planToExport(result.plan).settings.startCycle).toBe('2026-12')
  })
})

describe('desde cuándo acumula una línea (since)', () => {
  const raw = (extra) => ({ medio: 'debito', name: 'x', amount: 10, ...extra })

  it('se lee si es una clave de ciclo válida, y si no queda en null', () => {
    expect(normalizeLine(raw({ since: '2026-11' })).since).toBe('2026-11')
    expect(normalizeLine(raw({ since: 'ayer' })).since).toBeNull()
    expect(normalizeLine(raw({})).since).toBeNull()
  })

  it('sobrevive guardar y volver a leer', () => {
    const plan = normalizePlan({ lines: [{ id: 'a', ...raw({ since: '2026-11' }) }] })
    const stored = JSON.parse(JSON.stringify(planToTree(plan)))
    expect(normalizePlan(stored).lines[0].since).toBe('2026-11')
  })

  it('un archivo con since mal formado se rechaza', () => {
    const result = validatePlanInput({ lines: [{ id: 'a', ...raw({ since: '11/2026' }) }] })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('since')
  })
})
