import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/format'

interface Props {
  breakdown: { procurement: number; shipping: number; holding: number; penalty: number }
}

const COLORS = ['#8b5cf6', '#0ea5e9', '#f59e0b', '#f43f5e']

export function CostBreakdownChart({ breakdown }: Props) {
  const data = [
    { name: 'Procurement', value: breakdown.procurement },
    { name: 'Shipping',    value: breakdown.shipping },
    { name: 'Holding',     value: breakdown.holding },
    { name: 'Penalty',     value: breakdown.penalty },
  ].filter(d => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={105}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => fmt.currency(v)}
          contentStyle={{ borderRadius: 12, border: '1px solid #e4e4ef', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#6b6b88' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
