'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatCLP } from '@/lib/utils'

interface MonthData { label: string; ganado: number; pendiente: number; perdido: number }
interface EjecData { name: string; ganado: number; pendiente: number; perdido: number }

interface Props {
  monthlyData: MonthData[]
  ejecutivoData: EjecData[]
}

function CLPTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function ReportesCharts({ monthlyData, ejecutivoData }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Evolución mensual (CLP)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip content={<CLPTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ganado" name="Ganado" fill="#1B8A4B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pendiente" name="Pendiente" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="perdido" name="Perdido" fill="#D33A2C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {ejecutivoData.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Por ejecutivo (CLP ganado)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={ejecutivoData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#6b7280' }} width={80} />
              <Tooltip content={<CLPTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ganado" name="Ganado" fill="#1B8A4B" radius={[0, 4, 4, 0]} />
              <Bar dataKey="pendiente" name="Pendiente" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
