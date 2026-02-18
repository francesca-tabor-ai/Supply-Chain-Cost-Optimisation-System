import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { DemandForecastChart } from '../components/charts/DemandForecastChart'

const SAMPLE_SKUS = Array.from({ length: 8 }, (_, i) => `SKU-${String(i + 1).padStart(4, '0')}`)

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

  return (
    <div className="p-8">
      <PageHeader
        title="Demand Forecasting"
        description="ARIMA / Prophet / ETS ensemble — P50 baseline and P90 risk-averse forecasts"
        action={
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
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
            className={`px-3 py-1.5 text-sm rounded-lg font-mono font-medium transition-colors ${
              selectedSku === sku
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'
            }`}
          >
            {sku}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Card
        title={`Demand Forecast: ${selectedSku}`}
        subtitle="Historical actuals (purple) + P50 forecast (blue dashed) + P90 band (light blue)"
        className="mb-6"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : history ? (
          <DemandForecastChart
            history={history.history}
            forecast={forecastResults}
            sku={selectedSku}
          />
        ) : (
          <p className="text-gray-400 text-center py-12">No data for {selectedSku}</p>
        )}
      </Card>

      {/* Forecast results table */}
      {forecastResults.length > 0 && (
        <Card title="Forecast Results Table" subtitle={`Run ${runId?.slice(0, 8)}…`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-2 text-gray-500 font-medium">SKU</th>
                  <th className="pb-2 text-gray-500 font-medium">Location</th>
                  <th className="pb-2 text-gray-500 font-medium">Date</th>
                  <th className="pb-2 text-right text-gray-500 font-medium">P50</th>
                  <th className="pb-2 text-right text-gray-500 font-medium">P90</th>
                  <th className="pb-2 text-right text-gray-500 font-medium">Model</th>
                  <th className="pb-2 text-right text-gray-500 font-medium">MAPE</th>
                </tr>
              </thead>
              <tbody>
                {forecastResults
                  .filter(r => r.product_sku === selectedSku)
                  .slice(0, 15)
                  .map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs text-blue-700">{r.product_sku}</td>
                      <td className="py-2.5 text-gray-600">{r.location}</td>
                      <td className="py-2.5 text-gray-600">{r.date}</td>
                      <td className="py-2.5 text-right font-medium">{r.p50.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-blue-600">{r.p90.toLocaleString()}</td>
                      <td className="py-2.5 text-right">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                          {r.model}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-500">
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
