import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, StatCard, StatusPill } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart'
import { fmt } from '../utils/format'
import { BarChart2, Loader2, Star } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export default function Optimisation() {
  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['decisions'],
    queryFn: api.listDecisions,
  })

  const latestDone = (decisions as any[]).find(d => d.status === 'done')
  const optRunId = latestDone?.optimisation_run_id

  const { data: solution } = useQuery({
    queryKey: ['opt-solution', optRunId],
    queryFn: () => api.getOptimisationSolution(optRunId!),
    enabled: !!optRunId,
  })

  const allocations = solution?.allocations ?? []

  const barData = [...allocations]
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10)
    .map(a => ({
      label: `${a.product_sku}`,
      procurement: Math.round(a.unit_cost * a.qty),
      shipping:    Math.round(a.ship_cost * a.qty),
    }))

  const uniqueSuppliers = new Set(allocations.map((a: any) => a.supplier)).size

  return (
    <div className="p-8">
      <PageHeader
        badge="Optimisation"
        title="LP Optimisation Results"
        description="MILP solver output: supplier allocation plan, cost breakdown, binding constraints."
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cool-300" />
        </div>
      ) : solution ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Cost"          value={fmt.currency(solution.total_cost)} accent="violet" icon={<BarChart2 className="w-4 h-4" />} />
            <StatCard label="Solver Status"       value={solution.status} accent={solution.status === 'optimal' ? 'emerald' : 'amber'} />
            <StatCard label="Allocations"         value={allocations.length} sub="supplier × product × location" accent="sky" />
            <StatCard label="Unique Suppliers"    value={uniqueSuppliers} sub="suppliers used in plan" accent="violet" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
            {/* Cost breakdown */}
            {solution.cost_breakdown && (
              <Card title="Cost Breakdown" subtitle="By category">
                <CostBreakdownChart breakdown={solution.cost_breakdown as any} />
              </Card>
            )}

            {/* Top allocations bar */}
            <Card title="Top 10 Allocations" subtitle="Procurement vs Shipping cost stacked">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" margin={{ left: 60, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f5" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9898b0' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#9898b0', fontFamily: 'JetBrains Mono, monospace' }} width={60} />
                  <Tooltip
                    formatter={(v: number) => fmt.currency(v)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e4e4ef', fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="procurement" stackId="a" fill="#8b5cf6" name="Procurement" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="shipping"    stackId="a" fill="#0ea5e9" name="Shipping"    radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Full allocation table */}
          <Card title="Full Allocation Plan" subtitle={`${allocations.length} rows — sorted by total cost`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cool-100 text-left">
                    {['Product', 'Supplier', 'Rating', 'Location', 'Qty', 'Unit Cost', 'Ship/Unit', 'Total'].map(h => (
                      <th key={h} className="pb-3 text-[11px] font-semibold text-cool-400 uppercase tracking-wide pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a: any, i: number) => (
                    <tr key={i} className="border-b border-cool-50 hover:bg-cool-50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-violet-600 font-semibold pr-4">{a.product_sku}</td>
                      <td className="py-2.5 text-ink-800 pr-4">{a.supplier}</td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-0.5 text-amber-500 text-xs font-semibold">
                          <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                          {a.supplier_rating?.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 text-cool-500 pr-4">{a.location}</td>
                      <td className="py-2.5 tabular-nums font-semibold text-ink-900 pr-4">{fmt.number(a.qty)}</td>
                      <td className="py-2.5 tabular-nums text-cool-500 pr-4">{fmt.currency(a.unit_cost, 2)}</td>
                      <td className="py-2.5 tabular-nums text-cool-400 pr-4">{fmt.currency(a.ship_cost, 2)}</td>
                      <td className="py-2.5 font-bold text-ink-900">{fmt.currency(a.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-cool-200 shadow-card flex flex-col items-center justify-center min-h-[360px] text-cool-300">
          <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-semibold text-cool-400">No optimisation results yet</p>
          <p className="text-sm text-cool-300 mt-1">Go to Recommend and run the full pipeline first</p>
        </div>
      )}
    </div>
  )
}
