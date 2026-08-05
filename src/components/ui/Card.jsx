import { cn } from '../../lib/cn'

export function Card({ children, className, as: Tag = 'div', style, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-soft',
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </Tag>
  )
}
