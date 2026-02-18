import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { ForecastResult } from '../../api/client'

interface HistoryPoint { date: string; qty: number }

interface Props {
  history: HistoryPoint[]
  forecast: ForecastResult[]
  sku: string
}

export function DemandForecastChart({ history, forecast, sku }: Props) {
  // Merge history + forecast into a single timeline
  const historyData = history.slice(-26).map(h => ({
    date: h.date,
    actual: Math.round(h.qty),
    p50: null as number | null,
    p90: null as number | null,
  }))

  const forecastData = forecast
    .filter(f => f.product_sku === sku)
    .map(f => ({
      date: f.date,
      actual: null as number | null,
      p50: Math.round(f.p50),
      p90: Math.round(f.p90),
    }))

  const combined = [...historyData, ...forecastData]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={combined} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={d => d.slice(5)}  // show MM-DD
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(v: number, name: string) => [
            v?.toLocaleString() ?? '—',
            name === 'actual' ? 'Actual' : name === 'p50' ? 'Forecast P50' : 'Forecast P90',
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="Actual"
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="p90"
          fill="#bfdbfe"
          stroke="transparent"
          name="P90"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="p50"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          name="P50"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
