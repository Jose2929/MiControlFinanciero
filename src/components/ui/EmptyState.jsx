export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-muted">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
