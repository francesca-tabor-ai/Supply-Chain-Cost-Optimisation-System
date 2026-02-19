import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { DemandForecastChart } from '../components/charts/DemandForecastChart'

const SAMPLE_SKUS = Array.from({ length: 8 }, (_, i) => `SKU-${String(i + 1).padStart(4, '0')}`)

const MODEL_COLORS: Record<string, string> = {
  prophet: 'bg-violet-50 text-violet-700 border-violet-100',
  arima:   'bg-sky-50 text-sky-700 border-sky-100',
  ets:     'bg-amber-50 text-amber-700 border-amber-100',
  naive:   'bg-cool-100 text-cool-500 border-cool-200',
}

export default function Forecast() {
  const [selectedSku, setSelectedSku] = useState(SAMPLE_SKUS[0])
  const [runId, setRunId] = useState<string | null>(null)

  const { data: history, isFetching: loadingHistory } = useQuery({
    queryKey: ['history', selectedSku],
    queryFn: () => api.getDemandHistory(selectedSku),
  })

  const { data: forecastData } = useQuery({
    queryKey: ['forecast-results', runId],
    queryFn: () => api.getForecastResults(runId!),
    enabled: !!runId,
  })

  const mutation = useMutation({
    mutationFn: () => api.triggerForecast({ horizon: 13 }),
    onSuccess: (data) => setRunId(data.run_id),
  })

  const forecastResults = forecastData?.status === 'done' ? forecastData.results : []
  const skuForecast = forecastResults.filter(r => r.product_sku === selectedSku)

  // Aggregate model accuracy for selected SKU
  const modelUsed = skuForecast[0]?.model ?? null
  const mape = skuForecast[0]?.mape_pct ?? null
  const wape = skuForecast[0]?.wape ?? null

  return (
    <div className="p-8">
      <PageHeader
        badge="Forecasting"
        title="Demand Forecast"
        description="ARIMA · Prophet · ETS ensemble. Best model selected per SKU by validation WAPE."
        action={
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            {mutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <TrendingUp className="w-3.5 h-3.5" />}
            Run Forecast
          </button>
        }
      />

      {/* SKU selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SAMPLE_SKUS.map(sku => (
          <button
            key={sku}
            onClick={() => setSelectedSku(sku)}
            className={`px-3.5 py-1.5 text-xs rounded-xl font-mono font-semibold transition-all ${
              selectedSku === sku
                ? 'bg-ink-900 text-white shadow-sm'
                : 'bg-white border border-cool-200 text-cool-500 hover:border-cool-300 hover:text-ink-800'
            }`}
          >
            {sku}
          </button>
        ))}
      </div>

      {/* Model accuracy strip */}
      {modelUsed && (
        <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-white rounded-xl border border-cool-200 shadow-card w-fit">
          <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold font-mono ${MODEL_COLORS[modelUsed] ?? MODEL_COLORS.naive}`}>
            {modelUsed.toUpperCase()}
          </span>
          <span className="text-sm text-cool-400">Best model for <span className="font-semibold text-ink-800">{selectedSku}</span></span>
          {mape !== null && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
              MAPE {mape.toFixed(1)}%
            </span>
          )}
          {wape !== null && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 font-semibold">
              WAPE {(wape * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <Card
        title={`Demand Forecast — ${selectedSku}`}
        subtitle="Actuals (purple) · P50 median (blue dashed) · P90 band (light fill)"
        className="mb-5"
        action={
          loadingHistory
            ? <Loader2 className="w-4 h-4 animate-spin text-cool-300" />
            : <RefreshCw className="w-4 h-4 text-cool-300" />
        }
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="w-6 h-6 animate-spin text-cool-300" />
          </div>
        ) : history ? (
          <DemandForecastChart
            history={history.history}
            forecast={forecastResults}
            sku={selectedSku}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-cool-300 text-sm">
            No history for {selectedSku}
          </div>
        )}
      </Card>

      {/* Forecast table */}
      {skuForecast.length > 0 && (
        <Card
          title="Forecast Table"
          subtitle={`Run ${runId?.slice(0, 8)}… · ${skuForecast.length} periods`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cool-100 text-left">
                  {['Product', 'Location', 'Date', 'P50', 'P90', 'Model', 'MAPE'].map(h => (
                    <th key={h} className="pb-3 text-[11px] font-semibold text-cool-400 uppercase tracking-wide pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuForecast.slice(0, 16).map((r, i) => (
                  <tr key={i} className="border-b border-cool-50 hover:bg-cool-50 transition-colors">
                    <td className="py-2.5 font-mono text-xs text-violet-600 font-semibold pr-5">{r.product_sku}</td>
                    <td className="py-2.5 text-cool-500 pr-5">{r.location}</td>
                    <td className="py-2.5 text-ink-700 tabular-nums pr-5">{r.date}</td>
                    <td className="py-2.5 font-semibold text-ink-900 tabular-nums pr-5">{r.p50.toLocaleString()}</td>
                    <td className="py-2.5 text-sky-600 tabular-nums pr-5">{r.p90.toLocaleString()}</td>
                    <td className="py-2.5 pr-5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono font-semibold ${MODEL_COLORS[r.model] ?? MODEL_COLORS.naive}`}>
                        {r.model}
                      </span>
                    </td>
                    <td className="py-2.5 text-cool-500 tabular-nums">
                      {r.mape_pct != null ? `${r.mape_pct.toFixed(1)}%` : '—'}
                    </td>
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
