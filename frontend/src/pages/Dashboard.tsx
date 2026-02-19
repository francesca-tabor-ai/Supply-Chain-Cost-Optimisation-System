import { useQuery } from '@tanstack/react-query'
import { BarChart2, TrendingDown, Package, Zap, AlertTriangle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, DecisionRun } from '../api/client'
import { Card, StatCard, StatusPill } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { fmt } from '../utils/format'

export default function Dashboard() {
  const { data: decisions = [] } = useQuery({
    queryKey: ['decisions'],
    queryFn: api.listDecisions,
  })

  const latest = (decisions as any[]).find(d => d.status === 'done') as DecisionRun | undefined
  const summary = latest?.summary

  return (
    <div className="p-8">
      <PageHeader
        badge="Overview"
        title="Supply Chain Overview"
        description="AI-driven cost optimisation across procurement, logistics and inventory."
        action={
          <Link
            to="/app/recommend"
            className="flex items-center gap-2 bg-ink-900 hover:bg-ink-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Run Optimisation
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Cost Reduction"
          value={summary ? fmt.pct(summary.cost_reduction_estimate_pct) : '—'}
          sub="vs naive supplier selection"
          accent="emerald"
          trendUp={!!summary}
          trend={summary ? "vs baseline" : undefined}
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <StatCard
          label="Total Optimised Cost"
          value={summary ? fmt.currency(summary.total_cost) : '—'}
          sub="procurement + shipping + holding"
          accent="violet"
          icon={<BarChart2 className="w-4 h-4" />}
        />
        <StatCard
          label="Products Optimised"
          value={summary?.products_optimised ?? '—'}
          sub="SKUs in latest run"
          accent="sky"
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          label="Solve Time"
          value={summary ? `${summary.solve_time_ms}ms` : '—'}
          sub={summary?.solver_status ?? 'No run yet'}
          accent={summary?.solver_status === 'optimal' ? 'emerald' : 'amber'}
          icon={<Zap className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Top Recommendations */}
        <Card
          title="Recommended Allocations"
          subtitle="Optimal supplier × product pairings — latest run"
          action={
            <Link to="/app/optimisation" className="text-xs text-cool-400 hover:text-ink-900 font-semibold transition-colors flex items-center gap-1">
              Full view <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {summary?.top_recommendations?.length ? (
            <div className="space-y-1">
              {summary.top_recommendations.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-cool-50 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-mono text-xs text-violet-600 font-semibold w-20 flex-shrink-0">{r.product}</span>
                  <span className="text-sm text-ink-700 flex-1 truncate">{r.optimal_supplier}</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-ink-900">{fmt.currency(r.total_cost)}</p>
                    <p className="text-[10px] text-cool-400">{fmt.number(r.order_qty)} units</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Zap className="w-8 h-8" />}
              msg="Run an optimisation to see recommendations"
              action={<Link to="/app/recommend" className="text-sm text-violet-600 hover:text-violet-700 font-semibold">Run now →</Link>}
            />
          )}
        </Card>

        {/* Cost Breakdown */}
        <Card title="Cost Breakdown" subtitle="By category — latest optimisation run">
          {summary?.cost_breakdown ? (
            <div className="space-y-4">
              {Object.entries(summary.cost_breakdown).map(([key, val]) => {
                const total = Object.values(summary.cost_breakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? (val / total) * 100 : 0
                const cfg: Record<string, { bar: string; label: string }> = {
                  procurement: { bar: 'from-violet-500 to-purple-600', label: 'Procurement' },
                  shipping:    { bar: 'from-sky-500 to-blue-600',      label: 'Shipping' },
                  holding:     { bar: 'from-amber-400 to-orange-500',  label: 'Holding' },
                  penalty:     { bar: 'from-rose-500 to-red-500',      label: 'Stockout Penalty' },
                }
                const c = cfg[key] ?? { bar: 'from-cool-400 to-cool-500', label: key }
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-ink-800">{c.label}</span>
                      <span className="text-cool-500 tabular-nums">
                        {fmt.currency(val)} <span className="text-cool-300 text-xs">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-cool-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={<BarChart2 className="w-8 h-8" />} msg="No cost data yet" />
          )}
        </Card>

        {/* Binding Constraints */}
        <Card title="Binding Constraints" subtitle="What shaped the optimisation solution">
          {summary?.binding_constraints?.length ? (
            <div className="flex flex-wrap gap-2">
              {summary.binding_constraints.slice(0, 10).map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <code className="text-[10px] font-mono text-amber-700 font-semibold">{c}</code>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<AlertTriangle className="w-8 h-8" />} msg="No constraints data — run the optimisation first" />
          )}
        </Card>

        {/* Recent Runs */}
        <Card
          title="Recent Decision Runs"
          subtitle="Full pipeline history"
          action={<span className="text-[10px] font-mono text-cool-300">{(decisions as any[]).length} total</span>}
        >
          {(decisions as any[]).length ? (
            <div className="space-y-1">
              {(decisions as any[]).slice(0, 6).map((d: any) => (
                <div key={d.run_id} className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-cool-50 transition-colors">
                  <StatusPill status={d.status} />
                  <span className="font-mono text-[11px] text-cool-300 flex-1">{d.run_id.slice(0, 8)}…</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    {d.cost_reduction_pct ? `−${d.cost_reduction_pct}%` : '—'}
                  </span>
                  <span className="text-[11px] text-cool-300">
                    {d.created_at ? fmt.date(d.created_at) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Package className="w-8 h-8" />} msg="No runs yet" />
          )}
        </Card>
      </div>
    </div>
  )
}

function EmptyState({ icon, msg, action }: { icon: React.ReactNode; msg: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-cool-300">
      <div className="mb-3 opacity-25">{icon}</div>
      <p className="text-sm text-cool-400 text-center">{msg}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
