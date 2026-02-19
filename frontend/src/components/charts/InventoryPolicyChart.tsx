import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { InventoryResult } from '../../api/client'
import { fmt } from '../../utils/format'

interface Props { results: InventoryResult[] }

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e4e4ef',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
}

export function InventoryPolicyChart({ results }: Props) {
  const data = results.slice(0, 12).map(r => ({
    sku: r.product_sku,
    EOQ: Math.round(r.eoq),
    ROP: Math.round(r.rop),
    SS:  Math.round(r.safety_stock),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 36 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f5" vertical={false} />
        <XAxis
          dataKey="sku"
          tick={{ fontSize: 9, fill: '#9898b0', fontFamily: 'JetBrains Mono, monospace' }}
          angle={-35}
          textAnchor="end"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9898b0' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number) => fmt.number(v)}
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#6b6b88' }}
        />
        <Bar dataKey="EOQ" fill="#8b5cf6" name="EOQ (units)"    radius={[4, 4, 0, 0]} />
        <Bar dataKey="ROP" fill="#0ea5e9" name="Reorder Point"  radius={[4, 4, 0, 0]} />
        <Bar dataKey="SS"  fill="#f59e0b" name="Safety Stock"   radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
