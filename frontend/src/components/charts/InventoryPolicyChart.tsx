import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { InventoryResult } from '../../api/client'
import { fmt } from '../../utils/format'

interface Props {
  results: InventoryResult[]
}

export function InventoryPolicyChart({ results }: Props) {
  const data = results.slice(0, 12).map(r => ({
    sku: r.product_sku,
    EOQ: Math.round(r.eoq),
    ROP: Math.round(r.rop),
    SS: Math.round(r.safety_stock),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="sku" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => fmt.number(v)} />
        <Legend />
        <Bar dataKey="EOQ" fill="#3b82f6" name="EOQ (units)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="ROP" fill="#10b981" name="Reorder Point" radius={[3, 3, 0, 0]} />
        <Bar dataKey="SS" fill="#f59e0b" name="Safety Stock" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
