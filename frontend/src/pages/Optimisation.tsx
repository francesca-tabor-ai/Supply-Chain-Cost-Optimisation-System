import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, StatCard } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart'
import { fmt } from '../utils/format'
import { BarChart2, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
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

  // Bar chart: top 10 allocations by total cost
  const barData = [...allocations]
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10)
    .map(a => ({
      label: `${a.product_sku}/${a.supplier.split(' ')[0]}`,
      procurement: Math.round(a.total_cost - a.ship_cost * a.qty),
      shipping: Math.round(a.ship_cost * a.qty),
    }))

  return (
    <div className="p-8">
      <PageHeader
        title="LP Optimisation Results"
        description="MILP solver output: supplier allocation, cost breakdown, binding constraints"
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : solution ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Cost"
              value={fmt.currency(solution.total_cost)}
              color="blue"
            />
            <StatCard
              label="Solver Status"
              value={solution.status}
              color={solution.status === 'optimal' ? 'green' : 'amber'}
            />
            <StatCard
              label="Allocations"
              value={allocations.length}
              sub="supplier → product → location"
              color="blue"
            />
            <StatCard
              label="Unique Suppliers"
              value={new Set(allocations.map(a => a.supplier)).size}
              color="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cost breakdown donut */}
            {solution.cost_breakdown && (
              <Card title="Cost Breakdown" subtitle="By category">
                <CostBreakdownChart breakdown={solution.cost_breakdown as any} />
              </Card>
            )}

            {/* Top allocations bar */}
            <Card title="Top 10 Allocations" subtitle="Procurement vs Shipping cost">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => fmt.currency(v)} />
                  <Legend />
                  <Bar dataKey="procurement" stackId="a" fill="#3b82f6" name="Procurement" />
                  <Bar dataKey="shipping" stackId="a" fill="#10b981" name="Shipping" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Full allocation table */}
          <Card title="Full Allocation Plan">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Product', 'Supplier', 'Rating', 'Location', 'Qty', 'Unit Cost', 'Ship/Unit', 'Total'].map(h => (
                      <th key={h} className="pb-2 text-gray-500 font-medium pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs text-blue-700 pr-3">{a.product_sku}</td>
                      <td className="py-2.5 pr-3">{a.supplier}</td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs text-amber-600">★ {a.supplier_rating?.toFixed(1)}</span>
                      </td>
                      <td className="py-2.5 text-gray-500 pr-3">{a.location}</td>
                      <td className="py-2.5 font-medium pr-3">{fmt.number(a.qty)}</td>
                      <td className="py-2.5 pr-3">{fmt.currency(a.unit_cost, 2)}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{fmt.currency(a.ship_cost, 2)}</td>
                      <td className="py-2.5 font-semibold">{fmt.currency(a.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <BarChart2 className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No optimisation results yet</p>
          <p className="text-sm mt-1">Go to Recommend and run the pipeline first</p>
        </div>
      )}
    </div>
  )
}
