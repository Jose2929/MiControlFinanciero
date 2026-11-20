// Datos de prueba compartidos por las pruebas del presupuesto. Cifras
// FICTICIAS con la misma estructura que el plan real (el real vive en
// budget-seed.json, que no se versiona). No lo importa ningún código de la app.

export const line = (id, medio, kind, amount, extra = {}) => ({
  id,
  medio,
  kind,
  name: id,
  amount,
  payDay: null,
  payFrequency: 'mensual',
  isValve: false,
  ...extra,
})

// Cuentas de la app ficticias: una de crédito, una de débito y una de efectivo.
export function fixtureAccounts() {
  return [
    { id: 'acc-cred', name: 'Tarjeta A', type: 'credito', last4: '1234', used: 0, limit: 10000 },
    { id: 'acc-deb', name: 'Débito A', type: 'debito', last4: null, balance: 5000 },
    { id: 'acc-cash', name: 'Efectivo', type: 'efectivo', last4: null, balance: 800 },
  ]
}

export function fixturePlan() {
  return {
    version: 1,
    settings: { cycleStartDay: 1, cutDay: 3, payDueDay: 23, spendTransferDay: 15, cashWithdrawalParts: 2 },
    incomes: [
      { id: 'a', name: 'Persona A', amount: 20000, payDays: [15, 30], covers: ['tdc', 'tdc2', 'debito', 'efectivo'] },
      { id: 'b', name: 'Persona B', amount: 6000, payDays: [30], covers: ['ahorro'] },
    ],
    lines: [
      line('cargo-1', 'tdc', 'cargo', 7000, { payDay: 3 }),
      line('cargo-2', 'tdc', 'cargo', 4000, { payDay: 10 }),
      line('valvula', 'tdc', 'cargo', 1000, { payDay: 5, isValve: true }),
      line('bolsillo-anual', 'tdc2', 'bolsillo', 400, { payFrequency: 'anual' }),
      line('bolsillo-semestral', 'tdc2', 'bolsillo', 100, { payFrequency: 'semestral' }),
      line('fondo', 'tdc2', 'fondo', 500, { payFrequency: null }),
      line('sobre-d1', 'debito', 'sobre', 1500),
      line('sobre-d2', 'debito', 'sobre', 2500),
      line('sobre-e1', 'efectivo', 'sobre', 2000, { payDay: 15 }),
      line('sobre-e2', 'efectivo', 'sobre', 1000),
      line('ahorro-1', 'ahorro', 'ahorro', 3000, { payDay: 1 }),
      line('ahorro-2', 'ahorro', 'ahorro', 3000, { payDay: 1 }),
    ],
  }
}
