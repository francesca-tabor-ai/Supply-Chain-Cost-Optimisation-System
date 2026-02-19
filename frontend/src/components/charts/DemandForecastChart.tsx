import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ForecastResult } from '../../api/client'

interface HistoryPoint { date: string; qty: number }
interface Props {
  history: HistoryPoint[]
  forecast: ForecastResult[]
  sku: string
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e4e4ef',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
}

export function DemandForecastChart({ history, forecast, sku }: Props) {
  const historyData = history.slice(-26).map(h => ({
    date: h.date,
    actual: Math.round(h.qty),
    p50:  null as number | null,
    p90:  null as number | null,
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
      <ComposedChart data={combined} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="p90Fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f5" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9898b0' }}
          tickFormatter={d => d.slice(5)}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9898b0' }}
          width={50}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number, name: string) => [
            v?.toLocaleString() ?? '—',
            name === 'actual' ? 'Actual' : name === 'p50' ? 'Forecast P50' : 'Forecast P90 Band',
          ]}
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#6b6b88' }}
        />
        <Area
          type="monotone"
          dataKey="p90"
          fill="url(#p90Fill)"
          stroke="transparent"
          name="P90 Band"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          name="Actual"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="p50"
          stroke="#0ea5e9"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          name="P50"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
