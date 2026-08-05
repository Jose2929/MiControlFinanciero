import { Plus } from 'lucide-react'

export function Fab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="brand-gradient fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-semibold text-white shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 lg:bottom-8 lg:right-8"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
        <Plus className="h-5 w-5" />
      </span>
      Agregar gasto
    </button>
  )
}
