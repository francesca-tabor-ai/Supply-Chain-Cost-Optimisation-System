import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, CheckCircle, XCircle, Loader2, TrendingDown } from 'lucide-react'
import { api, DecisionRun } from '../api/client'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { fmt } from '../utils/format'
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart'

export default function Recommend() {
  const qc = useQueryClient()
  const [maxSuppliers, setMaxSuppliers] = useState(3)
  const [useP90, setUseP90] = useState(false)
  const [horizon, setHorizon] = useState(13)
  const [result, setResult] = useState<DecisionRun | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.recommend({
        use_p90_demand: useP90,
        max_suppliers_per_product: maxSuppliers,
        horizon_periods: horizon,
      }),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['decisions'] })
    },
  })

  const summary = result?.summary

  return (
    <div className="p-8">
      <PageHeader
        title="Run Optimisation"
        description="Execute the full pipeline: scrape → forecast → inventory → LP solve"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <Card title="Parameters" className="lg:col-span-1">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Demand scenario
              </label>
              <div className="flex gap-3">
                {[false, true].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => setUseP90(v)}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                      useP90 === v
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-gray-200 text-gray-600 hover:border-brand-400'
                    }`}
                  >
                    {v ? 'P90 (Conservative)' : 'P50 (Baseline)'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                P90 uses the 90th-percentile demand forecast for a risk-averse plan.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max suppliers per product: <strong>{maxSuppliers}</strong>
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={maxSuppliers}
                onChange={e => setMaxSuppliers(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1 (single source)</span>
                <span>6 (multi-source)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forecast horizon: <strong>{horizon} weeks</strong>
              </label>
              <input
                type="range"
                min={4}
                max={26}
                step={1}
                value={horizon}
                onChange={e => setHorizon(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>4 weeks</span>
                <span>26 weeks</span>
              </div>
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Running pipeline…</>
              ) : (
                <><Zap className="w-4 h-4" /> Run Optimisation</>
              )}
            </button>

            {mutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                Pipeline failed. Check API logs.
              </div>
            )}
          </div>
        </Card>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {summary ? (
            <>
              {/* Summary banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800 text-lg">
                    Optimisation complete — estimated{' '}
                    <span className="text-2xl font-bold">
                      {fmt.pct(summary.cost_reduction_estimate_pct)}
                    </span>{' '}
                    cost reduction
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {summary.products_optimised} products · Total cost:{' '}
                    {fmt.currency(summary.total_cost)} · Solve time: {summary.solve_time_ms}ms
                  </p>
                </div>
              </div>

              {/* Cost breakdown chart */}
              <Card title="Cost Breakdown" subtitle="By cost category">
                <CostBreakdownChart breakdown={summary.cost_breakdown} />
              </Card>

              {/* Top recommendations table */}
              <Card title="Recommended Allocations" subtitle="Top 5 by cost impact">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="pb-2 text-gray-500 font-medium">Product</th>
                        <th className="pb-2 text-gray-500 font-medium">Supplier</th>
                        <th className="pb-2 text-right text-gray-500 font-medium">Order Qty</th>
                        <th className="pb-2 text-right text-gray-500 font-medium">Unit Cost</th>
                        <th className="pb-2 text-right text-gray-500 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_recommendations.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 font-mono text-xs text-blue-700">{r.product}</td>
                          <td className="py-2.5 text-gray-800">{r.optimal_supplier}</td>
                          <td className="py-2.5 text-right">{fmt.number(r.order_qty)}</td>
                          <td className="py-2.5 text-right">{fmt.currency(r.unit_cost, 2)}</td>
                          <td className="py-2.5 text-right font-semibold">{fmt.currency(r.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <div className="text-center text-gray-400">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Configure parameters and click Run</p>
                <p className="text-sm mt-1">The full pipeline takes 30–90 seconds</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
