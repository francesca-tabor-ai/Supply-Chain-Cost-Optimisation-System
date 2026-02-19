interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  badge?: string
}

export function PageHeader({ title, description, action, badge }: Props) {
  return (
    <div className="flex items-start justify-between mb-8 pb-6 border-b border-cool-100">
      <div>
        {badge && (
          <span className="inline-block text-[10px] font-semibold tracking-widest text-cool-400 uppercase mb-2">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-cool-400 mt-1.5 leading-relaxed max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="ml-6 flex-shrink-0">{action}</div>}
    </div>
  )
}
