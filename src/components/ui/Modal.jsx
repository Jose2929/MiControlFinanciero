import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Modal({ open, onClose, title, children, className }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-soft',
          'animate-slide-up-sheet sm:animate-scale-in sm:max-w-lg sm:rounded-2xl',
          className
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface2 hover:text-ink"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
