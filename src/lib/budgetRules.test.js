import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RULE_SNIPPET } from '../components/budget/RulesNotice'

const rules = JSON.parse(readFileSync(resolve(process.cwd(), 'database.rules.json'), 'utf8'))
const household = rules.rules.households.$hid

describe('regla de Firebase del nodo budget', () => {
  it('existe, y usa las mismas condiciones que el perfil del hogar', () => {
    expect(household.budget).toBeDefined()
    expect(household.budget['.read']).toBe(household.profile['.read'])
    expect(household.budget['.write']).toBe(household.profile['.write'])
  })

  it('exige haber iniciado sesión y ser miembro de ese hogar', () => {
    for (const key of ['.read', '.write']) {
      expect(household.budget[key]).toContain('auth != null')
      expect(household.budget[key]).toContain("'households/' + $hid + '/members/' + auth.uid")
    }
  })

  it('el aviso de la pantalla muestra exactamente la regla del archivo', () => {
    expect(JSON.parse(`{${RULE_SNIPPET}}`).budget).toEqual(household.budget)
  })

  it('no se tocó ninguna otra regla', () => {
    expect(Object.keys(household).sort()).toEqual(
      ['budget', 'inviteCode', 'joinCodeUsed', 'members', 'meta', 'profile'].sort()
    )
  })
})
