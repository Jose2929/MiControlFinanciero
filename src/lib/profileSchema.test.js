import { describe, it, expect } from 'vitest'
import { deserializeProfile, serializeProfile } from './profileSchema'

// Cifras y datos FICTICIOS. Lo que se prueba: que el campo `envelopeId` que
// agrega el presupuesto convive con el perfil existente sin romper nada —
// las operaciones anteriores (sin ese campo) se leen igual que antes.

const tx = (extra) => ({
  id: 'exp-1001',
  type: 'expense',
  amount: 250,
  categoryId: 'comida',
  accountId: 'acc-1',
  note: 'Súper',
  date: new Date(2026, 10, 19),
  createdBy: 'uid-1',
  ...extra,
})

describe('perfil: envelopeId en las operaciones', () => {
  it('el sobre sobrevive al guardar y volver a leer', () => {
    const tree = serializeProfile({ transactions: [tx({ envelopeId: 'sobre-x' })] })
    const [read] = deserializeProfile(JSON.parse(JSON.stringify(tree))).transactions
    expect(read.envelopeId).toBe('sobre-x')
    expect(read.amount).toBe(250)
    expect(read.date).toBeInstanceOf(Date)
  })

  it('una operación sin sobre (todas las anteriores) se lee igual que siempre', () => {
    const tree = serializeProfile({ transactions: [tx()] })
    const [read] = deserializeProfile(JSON.parse(JSON.stringify(tree))).transactions
    expect(read.envelopeId).toBeUndefined()
    expect(read).toMatchObject({ id: 'exp-1001', type: 'expense', amount: 250, accountId: 'acc-1', note: 'Súper' })
  })

  it('envelopeId nulo (sin sobre) se descarta al guardar en RTDB y se lee como ausente', () => {
    const tree = serializeProfile({ transactions: [tx({ envelopeId: null })] })
    const stored = JSON.parse(JSON.stringify(tree))
    delete stored.transactions['exp-1001'].envelopeId // RTDB no guarda los null
    const [read] = deserializeProfile(stored).transactions
    expect(read.envelopeId).toBeUndefined()
  })

  it('un perfil anterior al presupuesto (sin ningún campo nuevo) se carga completo', () => {
    const legacy = {
      meta: { schemaVersion: 2, updatedAt: '2026-08-07T05:23:46.583Z' },
      idCounter: 1016,
      accounts: { 'acc-1': { id: 'acc-1', name: 'Débito', type: 'debito', balance: 100 } },
      transactions: {
        'exp-1': { id: 'exp-1', type: 'expense', amount: 10, accountId: 'acc-1', categoryId: 'comida', date: '2026-08-01T06:00:00.000Z' },
        'and-9': { id: 'and-9', type: 'expense', amount: 20, accountId: 'acc-1', categoryId: 'otros', date: '2026-08-02T06:00:00.000Z' },
      },
    }
    const data = deserializeProfile(legacy)
    expect(data.transactions).toHaveLength(2)
    expect(data.transactions.every((t) => t.envelopeId === undefined)).toBe(true)
    expect(data.accounts[0].balance).toBe(100)
  })

  it('guardar un perfil no inventa claves de presupuesto en el árbol', () => {
    const tree = serializeProfile({ transactions: [tx({ envelopeId: 'sobre-x' })] })
    expect(Object.keys(tree).sort()).toEqual(
      [
        'accounts',
        'budgetTotalLimit',
        'customCategories',
        'debtConfirmations',
        'debts',
        'idCounter',
        'incomeProfiles',
        'budgets',
        'meta',
        'readIds',
        'recurringBills',
        'recurringConfirmations',
        'transactions',
      ].sort()
    )
  })
})
