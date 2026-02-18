import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Package } from 'lucide-react'
import { api } from '../api/client'
import { Card, StatCard } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { InventoryPolicyChart } from '../components/charts/InventoryPolicyChart'
import { fmt } from '../utils/format'

export default function Inventory() {
  const [forecastRunId, setForecastRunId] = useState('')
  const [policyRunId, setPolicyRunId] = useState<string | null>(null)

  const { data: policyData } = useQuery({
    queryKey: ['inventory-policy', policyRunId],
    queryFn: () => api.getInventoryPolicy(policyRunId!),
    enabled: !!policyRunId,
  })

  const { data: inventoryState = [] } = useQuery({
    queryKey: ['inventory-state'],
    queryFn: api.getInventoryState,
  })

  const forecastMutation = useMutation({
    mutationFn: () => api.triggerForecast({ horizon: 13 }),
    onSuccess: (data) => setForecastRunId(data.run_id),
  })

  const policyMutation = useMutation({
    mutationFn: () => api.getInventoryPolicy(forecastRunId).then(() =>
      fetch('/api/inventory/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecast_run_id: forecastRunId }),
      }).then(r => r.json())
    ),
    onSuccess: (data: any) => setPolicyRunId(data.run_id),
  })

  const results = policyData?.status === 'done' ? policyData.results : []

  const totalHolding = results.reduce((s, r) => s + (r.annual_holding_cost || 0), 0)
  const totalOrdering = results.reduce((s, r) => s + (r.annual_ordering_cost || 0), 0)
  const avgServiceLevel = results.length
    ? results.reduce((s, r) => s + r.service_level_pct, 0) / results.length
    : 0

  return (
    <div className="p-8">
      <PageHeader
        title="Inventory Policy"
        description="Economic Order Quantity · Reorder Point · Safety Stock"
        action={
          <button
            onClick={() => forecastMutation.mutate()}
            disabled={forecastMutation.isPending}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {forecastMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Compute Policy
          </button>
        }
      />

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Annual Holding Cost" value={fmt.currency(totalHolding)} color="amber" />
            <StatCard label="Annual Ordering Cost" value={fmt.currency(totalOrdering)} color="blue" />
            <StatCard
              label="Avg Service Level"
              value={fmt.pct(avgServiceLevel)}
              color="green"
            />
          </div>

          <Card title="EOQ / ROP / Safety Stock by SKU" className="mb-6">
            <InventoryPolicyChart results={results} />
          </Card>

          <Card title="Policy Details Table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['SKU', 'Location', 'EOQ', 'ROP', 'Safety Stock', 'Avg Wkly Demand', 'SL%', 'Annual Cost'].map(h => (
                      <th key={h} className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs text-blue-700 pr-4">{r.product_sku}</td>
                      <td className="py-2.5 text-gray-600 pr-4">{r.location}</td>
                      <td className="py-2.5 font-medium pr-4">{fmt.number(r.eoq)}</td>
                      <td className="py-2.5 pr-4">{fmt.number(r.rop)}</td>
                      <td className="py-2.5 pr-4">{fmt.number(r.safety_stock)}</td>
                      <td className="py-2.5 pr-4">{fmt.number(r.avg_weekly_demand, 0)}</td>
                      <td className="py-2.5 pr-4">{fmt.pct(r.service_level_pct)}</td>
                      <td className="py-2.5 font-semibold">{fmt.currency(r.annual_total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Current Inventory State */}
      {inventoryState.length > 0 && (
        <Card title="Current Inventory Snapshot" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  {['SKU', 'Location', 'On Hand', 'On Order', 'Backorder'].map(h => (
                    <th key={h} className="pb-2 text-gray-500 font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventoryState.slice(0, 20).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-mono text-xs text-blue-700 pr-4">{r.sku}</td>
                    <td className="py-2.5 text-gray-600 pr-4">{r.location}</td>
                    <td className="py-2.5 font-medium pr-4">{fmt.number(r.on_hand)}</td>
                    <td className="py-2.5 pr-4">{fmt.number(r.on_order)}</td>
                    <td className="py-2.5 text-red-600 pr-4">{fmt.number(r.backorder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
