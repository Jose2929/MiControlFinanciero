import { cn } from '../../lib/cn'

export function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && <p className="text-sm font-medium text-ink">{label}</p>}
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'brand-gradient border-transparent' : 'bg-surface2 border-line'
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}
