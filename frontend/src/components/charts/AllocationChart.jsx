import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6']

function formatPLN(v) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v)
}

export default function AllocationChart({ positions }) {
  const grouped = {}
  for (const p of positions) {
    const key = p.asset_class || 'Inne'
    grouped[key] = (grouped[key] || 0) + (p.current_value_pln || p.cost_pln || 0)
  }

  const data = Object.entries(grouped)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (!data.length) return null

  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-700 mb-4">Alokacja aktywów</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [formatPLN(v), 'Wartość']}
            contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
            labelStyle={{ color: '#6b7280' }}
            itemStyle={{ color: '#111827' }}
          />
          <Legend
            formatter={(v) => <span style={{ color: '#6b7280', fontSize: 12 }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
