import { ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function Card({ title, subtitle, children, className, action }: CardProps) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-cool-200 shadow-card', className)}>
      {title && (
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-cool-100">
          <div>
            <h3 className="text-sm font-semibold text-ink-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-cool-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: string
  trendUp?: boolean
  accent?: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose'
  icon?: ReactNode
}

const accentMap = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'from-violet-500 to-purple-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'from-emerald-500 to-teal-600' },
  amber:   { bg: 'bg-amber-50',  text: 'text-amber-600',   bar: 'from-amber-500 to-yellow-500' },
  sky:     { bg: 'bg-sky-50',    text: 'text-sky-600',     bar: 'from-sky-500 to-blue-600' },
  rose:    { bg: 'bg-rose-50',   text: 'text-rose-600',    bar: 'from-rose-500 to-pink-600' },
}

export function StatCard({ label, value, sub, trend, trendUp, accent = 'violet', icon }: StatCardProps) {
  const a = accentMap[accent]
  return (
    <div className="bg-white rounded-2xl border border-cool-200 shadow-card hover:shadow-card-hover transition-shadow duration-300 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold text-cool-400 tracking-widest uppercase">{label}</p>
        {icon && (
          <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center', a.bg)}>
            <span className={a.text}>{icon}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-ink-900 tracking-tight leading-none">{value}</p>
        {sub && <p className="text-xs text-cool-400 mt-1.5 leading-snug">{sub}</p>}
      </div>
      {trend && (
        <p className={clsx('text-xs font-semibold', trendUp ? 'text-emerald-600' : 'text-rose-600')}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
      <div className={clsx('h-0.5 rounded-full bg-gradient-to-r opacity-50', a.bar)} />
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done:       'bg-emerald-50 text-emerald-700 border-emerald-100',
    optimal:    'bg-emerald-50 text-emerald-700 border-emerald-100',
    running:    'bg-sky-50 text-sky-700 border-sky-100',
    pending:    'bg-cool-100 text-cool-500 border-cool-200',
    failed:     'bg-rose-50 text-rose-700 border-rose-100',
    infeasible: 'bg-amber-50 text-amber-700 border-amber-100',
  }
  const dots: Record<string, string> = {
    done: 'bg-emerald-500', optimal: 'bg-emerald-500',
    running: 'bg-sky-500 animate-pulse',
    pending: 'bg-cool-300',
    failed: 'bg-rose-500', infeasible: 'bg-amber-500',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-semibold tracking-wide', styles[status] ?? styles.pending)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dots[status] ?? dots.pending)} />
      {status}
    </span>
  )
}
