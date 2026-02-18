import { useQuery } from '@tanstack/react-query'
import { BarChart2, TrendingDown, Package, AlertTriangle, Zap } from 'lucide-react'
import { api, DecisionRun } from '../api/client'
import { Card, StatCard } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { fmt } from '../utils/format'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { data: decisions = [] } = useQuery({
    queryKey: ['decisions'],
    queryFn: api.listDecisions,
  })

  const latest = decisions.find((d: any) => d.status === 'done') as DecisionRun | undefined
  const summary = latest?.summary

  return (
    <div className="p-8">
      <PageHeader
        title="Supply Chain Overview"
        description="AI-driven cost optimisation — procurement, logistics & inventory"
        action={
          <Link
            to="/recommend"
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            Run Optimisation
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Cost Reduction"
          value={summary ? fmt.pct(summary.cost_reduction_estimate_pct) : '—'}
          sub="vs naive supplier selection"
          color="green"
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <StatCard
          label="Total Optimised Cost"
          value={summary ? fmt.currency(summary.total_cost) : '—'}
          sub="procurement + shipping + holding"
          color="blue"
          icon={<BarChart2 className="w-5 h-5" />}
        />
        <StatCard
          label="Products Optimised"
          value={summary?.products_optimised ?? '—'}
          sub="SKUs in latest run"
          color="blue"
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          label="Solver Status"
          value={summary?.solver_status ?? '—'}
          sub={summary ? `${summary.solve_time_ms}ms solve time` : 'No run yet'}
          color={summary?.solver_status === 'optimal' ? 'green' : 'amber'}
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recommendations */}
        <Card title="Top Recommendations" subtitle="Latest optimisation run">
          {summary?.top_recommendations?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Supplier</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Qty</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Unit $</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_recommendations.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs text-blue-700">{r.product}</td>
                      <td className="py-2.5 text-gray-700">{r.optimal_supplier}</td>
                      <td className="py-2.5 text-right">{fmt.number(r.order_qty)}</td>
                      <td className="py-2.5 text-right font-medium">{fmt.currency(r.unit_cost, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState msg="Run an optimisation to see recommendations" />
          )}
        </Card>

        {/* Cost Breakdown */}
        <Card title="Cost Breakdown" subtitle="Latest run — by cost type">
          {summary?.cost_breakdown ? (
            <div className="space-y-3">
              {Object.entries(summary.cost_breakdown).map(([key, val]) => {
                const total = Object.values(summary.cost_breakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? (val / total) * 100 : 0
                const colors: Record<string, string> = {
                  procurement: 'bg-blue-500',
                  shipping: 'bg-green-500',
                  holding: 'bg-amber-500',
                  penalty: 'bg-red-500',
                }
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-600">{key}</span>
                      <span className="font-medium">{fmt.currency(val)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className={`h-2 rounded-full ${colors[key] ?? 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState msg="No cost data yet" />
          )}
        </Card>

        {/* Binding Constraints */}
        <Card title="Binding Constraints" subtitle="Constraints that shaped the solution">
          {summary?.binding_constraints?.length ? (
            <ul className="space-y-1.5">
              {summary.binding_constraints.slice(0, 8).map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c}</code>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState msg="No binding constraints in latest run" />
          )}
        </Card>

        {/* Recent runs */}
        <Card title="Recent Decision Runs" subtitle="Optimisation history">
          {decisions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Run ID</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Reduction</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.slice(0, 6).map((d: any) => (
                    <tr key={d.run_id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs text-gray-500">{d.run_id.slice(0, 8)}…</td>
                      <td className="py-2.5">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-2.5 text-right text-green-600 font-medium">
                        {d.cost_reduction_pct ? `−${d.cost_reduction_pct}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">
                        {d.created_at ? fmt.date(d.created_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState msg="No runs yet" />
          )}
        </Card>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: 'bg-green-100 text-green-700',
    running: 'bg-blue-100 text-blue-700',
    pending: 'bg-gray-100 text-gray-600',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 py-4 text-center">{msg}</p>
}
