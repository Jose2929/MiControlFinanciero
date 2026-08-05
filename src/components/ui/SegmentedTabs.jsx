import { cn } from '../../lib/cn'

export function SegmentedTabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-surface2 p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150',
            value === tab.value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
