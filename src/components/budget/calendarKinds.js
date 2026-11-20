import { ArrowLeftRight, Banknote, CircleDollarSign, CreditCard, PiggyBank, Scissors, ShoppingBag } from 'lucide-react'

// Cómo se ve cada tipo de evento del calendario: nombre corto, icono y color.
export const KIND_META = {
  ingreso: { label: 'Sueldo', icon: Banknote, tone: 'text-positive' },
  transferencia: { label: 'Transferencia', icon: ArrowLeftRight, tone: 'text-brand-300' },
  pago: { label: 'Pago de la TDC', icon: CircleDollarSign, tone: 'text-negative' },
  cargo: { label: 'Cargo a la TDC', icon: CreditCard, tone: 'text-warning' },
  gasto: { label: 'Gasto programado', icon: ShoppingBag, tone: 'text-ink' },
  ahorro: { label: 'Ahorro', icon: PiggyBank, tone: 'text-positive' },
  corte: { label: 'Corte de la TDC', icon: Scissors, tone: 'text-muted' },
}
