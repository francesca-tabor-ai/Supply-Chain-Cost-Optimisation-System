import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Package, RefreshCw } from 'lucide-react'
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
    mutationFn: async () => {
      const forecast = await api.triggerForecast({ horizon: 13 })
      setForecastRunId(forecast.run_id)
      const res = await fetch('/api/inventory/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecast_run_id: forecast.run_id }),
      })
      return res.json()
    },
    onSuccess: (data: any) => setPolicyRunId(data.run_id),
  })

  const results = policyData?.status === 'done' ? policyData.results : []
  const totalHolding  = results.reduce((s, r) => s + (r.annual_holding_cost  || 0), 0)
  const totalOrdering = results.reduce((s, r) => s + (r.annual_ordering_cost || 0), 0)
  const avgSL = results.length ? results.reduce((s, r) => s + r.service_level_pct, 0) / results.length : 0

  return (
    <div className="p-8">
      <PageHeader
        badge="Inventory"
        title="Inventory Policy"
        description="Economic Order Quantity · Reorder Point · Safety Stock — computed per product × location."
        action={
          <button
            onClick={() => forecastMutation.mutate()}
            disabled={forecastMutation.isPending}
            className="flex items-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            {forecastMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Package className="w-3.5 h-3.5" />}
            Compute Policy
          </button>
        }
      />

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Annual Holding Cost"  value={fmt.currency(totalHolding)}  accent="amber" icon={<Package className="w-4 h-4" />} />
            <StatCard label="Annual Ordering Cost" value={fmt.currency(totalOrdering)} accent="sky"   icon={<RefreshCw className="w-4 h-4" />} />
            <StatCard label="Avg Service Level"    value={fmt.pct(avgSL)}              accent="emerald" trend="across all SKUs × locations" trendUp />
          </div>

          <Card title="EOQ · ROP · Safety Stock by SKU" subtitle="Top 12 products" className="mb-5">
            <InventoryPolicyChart results={results} />
          </Card>

          <Card title="Policy Detail" subtitle={`${results.length} product × location pairs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cool-100 text-left">
                    {['SKU', 'Location', 'EOQ', 'ROP', 'Safety Stock', 'Avg Wkly Demand', 'SL %', 'Annual Cost'].map(h => (
                      <th key={h} className="pb-3 text-[11px] font-semibold text-cool-400 uppercase tracking-wide pr-5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-cool-50 hover:bg-cool-50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-violet-600 font-semibold pr-5">{r.product_sku}</td>
                      <td className="py-2.5 text-cool-500 pr-5">{r.location}</td>
                      <td className="py-2.5 font-semibold text-ink-900 tabular-nums pr-5">{fmt.number(r.eoq)}</td>
                      <td className="py-2.5 tabular-nums pr-5">{fmt.number(r.rop)}</td>
                      <td className="py-2.5 tabular-nums pr-5">{fmt.number(r.safety_stock)}</td>
                      <td className="py-2.5 tabular-nums text-cool-500 pr-5">{fmt.number(r.avg_weekly_demand, 0)}</td>
                      <td className="py-2.5 pr-5">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-100">
                          {fmt.pct(r.service_level_pct)}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-ink-900">{fmt.currency(r.annual_total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Live inventory snapshot */}
      {(inventoryState as any[]).length > 0 && (
        <Card title="Current Inventory Snapshot" subtitle="On-hand · On order · Backorder" className="mt-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cool-100 text-left">
                  {['SKU', 'Location', 'On Hand', 'On Order', 'Backorder'].map(h => (
                    <th key={h} className="pb-3 text-[11px] font-semibold text-cool-400 uppercase tracking-wide pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(inventoryState as any[]).slice(0, 20).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-cool-50 hover:bg-cool-50 transition-colors">
                    <td className="py-2.5 font-mono text-xs text-violet-600 font-semibold pr-5">{r.sku}</td>
                    <td className="py-2.5 text-cool-500 pr-5">{r.location}</td>
                    <td className="py-2.5 font-semibold text-ink-900 tabular-nums pr-5">{fmt.number(r.on_hand)}</td>
                    <td className="py-2.5 tabular-nums pr-5">{fmt.number(r.on_order)}</td>
                    <td className="py-2.5 tabular-nums pr-5">
                      {r.backorder > 0
                        ? <span className="text-rose-600 font-semibold">{fmt.number(r.backorder)}</span>
                        : <span className="text-cool-300">0</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results.length === 0 && (inventoryState as any[]).length === 0 && !forecastMutation.isPending && (
        <div className="bg-white rounded-2xl border border-cool-200 shadow-card flex flex-col items-center justify-center min-h-[300px] text-cool-300">
          <Package className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-semibold text-cool-400">Click "Compute Policy" to generate inventory parameters</p>
          <p className="text-sm text-cool-300 mt-1">Runs a forecast then computes EOQ, ROP, and safety stock</p>
        </div>
      )}
    </div>
  )
}
