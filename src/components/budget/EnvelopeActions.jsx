import { ClipboardCheck, Plus, Receipt } from 'lucide-react'
import { cn } from '../../lib/cn'

const BUTTON =
  'flex h-9 min-w-[5.25rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface2 px-2 text-xs font-medium text-ink ' +
  'transition-colors hover:bg-line/60 active:bg-line disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface2'

// Las tres cosas que se hacen con un sobre, siempre a la vista:
//   Agregar → suma (o saca) dinero del sobre sin tocar cuentas.
//   Gasto   → registra un gasto de verdad; baja el sobre y la cuenta.
//   Ajustar → "según la app tiene $X, pero en realidad tiene $Y".
//
// En tarjetas angostas los botones pasan a otra línea en lugar de cortarse.
// `disabled` apaga los tres (ciclo que aún no empieza). `onSpend` puede faltar
// cuando el medio del sobre no tiene una cuenta ligada.
export function EnvelopeActions({ item, onAdd, onSpend, onAdjust, disabled = false, className }) {
  const name = item.line.name
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd?.(item)}
        aria-label={`Agregar dinero a ${name}`}
        className={BUTTON}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Agregar</span>
      </button>
      <button
        type="button"
        disabled={disabled || !onSpend}
        onClick={() => onSpend?.(item)}
        aria-label={`Registrar gasto en ${name}`}
        title={!onSpend && !disabled ? 'Liga una cuenta a este medio en Plan → Cuentas de la app' : undefined}
        className={BUTTON}
      >
        <Receipt className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Gasto</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdjust?.(item)}
        aria-label={`Ajustar ${name}`}
        className={BUTTON}
      >
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Ajustar</span>
      </button>
    </div>
  )
}
