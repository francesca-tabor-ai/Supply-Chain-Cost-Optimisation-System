import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/format'

interface Props {
  breakdown: { procurement: number; shipping: number; holding: number; penalty: number }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
const LABELS = ['Procurement', 'Shipping', 'Holding', 'Penalty']

export function CostBreakdownChart({ breakdown }: Props) {
  const data = [
    { name: 'Procurement', value: breakdown.procurement },
    { name: 'Shipping', value: breakdown.shipping },
    { name: 'Holding', value: breakdown.holding },
    { name: 'Penalty', value: breakdown.penalty },
  ].filter(d => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => fmt.currency(v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
