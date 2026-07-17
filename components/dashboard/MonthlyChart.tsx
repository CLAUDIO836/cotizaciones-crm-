'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface MonthData {
  month: string
  ganadas: number
  perdidas: number
  abiertas: number
  monto: number
}

export default function MonthlyChart({ data }: { data: MonthData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ganadas" name="Ganadas" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="abiertas" name="Abiertas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
