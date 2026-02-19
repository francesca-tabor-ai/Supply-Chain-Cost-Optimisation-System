import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, CheckCircle2, XCircle, Loader2, TrendingDown, ArrowRight } from 'lucide-react'
import { api, DecisionRun } from '../api/client'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { fmt } from '../utils/format'
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart'

function Toggle({ value, onChange, options }: {
  value: boolean; onChange: (v: boolean) => void
  options: [string, string]
}) {
  return (
    <div className="flex rounded-xl border border-cool-200 bg-cool-50 p-1 gap-1">
      {([false, true] as boolean[]).map((v, i) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            value === v
              ? 'bg-ink-900 text-white shadow-sm'
              : 'text-cool-500 hover:text-ink-800'
          }`}
        >
          {options[i]}
        </button>
      ))}
    </div>
  )
}

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
        badge="Pipeline"
        title="Run Optimisation"
        description="Execute the full pipeline: supplier scraping → demand forecasting → inventory policy → LP solve."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Config panel */}
        <Card title="Parameters" className="lg:col-span-1 self-start">
          <div className="space-y-6">

            <div>
              <label className="block text-xs font-semibold text-ink-800 mb-2 tracking-wide">Demand scenario</label>
              <Toggle value={useP90} onChange={setUseP90} options={['P50 Baseline', 'P90 Conservative']} />
              <p className="text-[11px] text-cool-400 mt-2 leading-relaxed">
                P90 uses the 90th-percentile demand for a risk-averse plan.
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-semibold text-ink-800 tracking-wide">Max suppliers / product</label>
                <span className="text-xs font-bold text-violet-600">{maxSuppliers}</span>
              </div>
              <input
                type="range" min={1} max={6} value={maxSuppliers}
                onChange={e => setMaxSuppliers(Number(e.target.value))}
                className="w-full h-1.5 rounded-full accent-violet-600 bg-cool-200 appearance-none"
              />
              <div className="flex justify-between text-[10px] text-cool-300 mt-1">
                <span>1 — single source</span>
                <span>6 — multi-source</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-semibold text-ink-800 tracking-wide">Forecast horizon</label>
                <span className="text-xs font-bold text-violet-600">{horizon}w</span>
              </div>
              <input
                type="range" min={4} max={26} value={horizon}
                onChange={e => setHorizon(Number(e.target.value))}
                className="w-full h-1.5 rounded-full accent-violet-600 bg-cool-200 appearance-none"
              />
              <div className="flex justify-between text-[10px] text-cool-300 mt-1">
                <span>4 weeks</span><span>26 weeks</span>
              </div>
            </div>

            {/* Config summary */}
            <div className="bg-cool-50 rounded-xl p-4 border border-cool-100 space-y-2">
              {[
                ['Scenario', useP90 ? 'P90 (conservative)' : 'P50 (baseline)'],
                ['Max suppliers', String(maxSuppliers)],
                ['Horizon', `${horizon} weeks`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-cool-400">{k}</span>
                  <span className="font-semibold text-ink-800 font-mono">{v}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Running pipeline…</>
              ) : (
                <><Zap className="w-4 h-4" /> Run Full Pipeline</>
              )}
            </button>

            {mutation.isError && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 rounded-xl p-3 border border-rose-100">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                Pipeline failed. Check API at localhost:8000/docs
              </div>
            )}
          </div>
        </Card>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {mutation.isPending && (
            <div className="bg-white rounded-2xl border border-cool-200 shadow-card p-10 flex flex-col items-center gap-4 text-cool-400">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cool-200 animate-spin border-t-violet-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-ink-800">Running pipeline…</p>
                <p className="text-sm mt-1">Scraping → Forecasting → Inventory → Optimising</p>
              </div>
              <div className="flex gap-2">
                {['Scraper', 'Forecast', 'Inventory', 'LP Solve'].map((s, i) => (
                  <span key={s} className="text-[10px] px-2 py-1 rounded-lg bg-cool-100 text-cool-400 font-mono">{s}</span>
                ))}
              </div>
            </div>
          )}

          {summary && !mutation.isPending && (
            <>
              {/* Success banner */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">
                    Optimisation complete — estimated{' '}
                    <span className="text-2xl font-bold gradient-text">
                      −{fmt.pct(summary.cost_reduction_estimate_pct)}
                    </span>{' '}
                    cost reduction
                  </p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {summary.products_optimised} products · Total cost: {fmt.currency(summary.total_cost)} ·{' '}
                    Solve: {summary.solve_time_ms}ms · Status:{' '}
                    <span className="font-semibold">{summary.solver_status}</span>
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              </div>

              {/* Cost breakdown */}
              <Card title="Cost Breakdown" subtitle="Procurement · Shipping · Holding · Penalty">
                <CostBreakdownChart breakdown={summary.cost_breakdown} />
              </Card>

              {/* Recommendations table */}
              <Card title="Optimal Allocations" subtitle="Top recommendations by cost impact">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cool-100 text-left">
                        {['#', 'Product', 'Supplier', 'Order Qty', 'Unit Cost', 'Total'].map(h => (
                          <th key={h} className="pb-3 text-[11px] font-semibold text-cool-400 tracking-wide uppercase pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_recommendations.map((r, i) => (
                        <tr key={i} className="border-b border-cool-50 hover:bg-cool-50 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="w-5 h-5 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white">{i + 1}</span>
                          </td>
                          <td className="py-3 font-mono text-xs text-violet-600 font-semibold pr-4">{r.product}</td>
                          <td className="py-3 text-ink-800 pr-4">{r.optimal_supplier}</td>
                          <td className="py-3 tabular-nums text-cool-600 pr-4">{fmt.number(r.order_qty)}</td>
                          <td className="py-3 tabular-nums text-cool-600 pr-4">{fmt.currency(r.unit_cost, 2)}</td>
                          <td className="py-3 font-bold text-ink-900">{fmt.currency(r.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {!summary && !mutation.isPending && (
            <div className="bg-white rounded-2xl border border-cool-200 shadow-card flex flex-col items-center justify-center min-h-[320px] text-cool-300">
              <Zap className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-semibold text-cool-400">Configure parameters and run the pipeline</p>
              <p className="text-sm text-cool-300 mt-1">Typical runtime: 30–90 seconds</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
