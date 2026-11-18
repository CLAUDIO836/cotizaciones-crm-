'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { formatCLP, getMonthName } from '@/lib/utils'
import type { QuotationSummary } from '@/lib/api'

type Period = 'day' | 'month' | 'year'
interface Profile { id: string; name: string }

function qDate(q: QuotationSummary): { y: number; m: number; dateStr: string } {
  if (q.issue_date) {
    const d = new Date(q.issue_date)
    return { y: d.getFullYear(), m: d.getMonth() + 1, dateStr: q.issue_date.slice(0, 10) }
  }
  if (q.year && q.month) return { y: Number(q.year), m: Number(q.month), dateStr: '' }
  return { y: 0, m: 0, dateStr: '' }
}

function kpiTile(label: string, value: string, sub?: string, accent?: string) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ?? '#111827' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

interface DrillItem {
  label: string
  qs: QuotationSummary[]
  status?: 'won' | 'lost' | 'open'
}

export default function DashboardClient({
  quotations,
  profiles,
  companies,
}: {
  quotations: QuotationSummary[]
  profiles: Profile[]
  companies: string[]
}) {
  const [period, setPeriod] = useState<Period>('month')
  const [ejecutiva, setEjecutiva] = useState('all')
  const [empresa, setEmpresa] = useState('all')
  const [drill, setDrill] = useState<DrillItem | null>(null)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const filtered = useMemo(() =>
    quotations.filter(q => {
      if (ejecutiva !== 'all' && q.vendedor_id !== ejecutiva) return false
      if (empresa !== 'all' && q.company !== empresa) return false
      return true
    }),
    [quotations, ejecutiva, empresa],
  )

  // KPIs
  const thisMonth = filtered.filter(q => { const { y, m } = qDate(q); return y === currentYear && m === currentMonth })
  const openCount = filtered.filter(q => q.status === 'open').length
  const wonThisMonth = thisMonth.filter(q => q.status === 'won').reduce((s, q) => s + Number(q.total ?? 0), 0)
  const wonCountThisMonth = thisMonth.filter(q => q.status === 'won').length
  const convRate = thisMonth.length > 0 ? Math.round((wonCountThisMonth / thisMonth.length) * 100) : 0
  const totalCotizado = filtered.reduce((s, q) => s + Number(q.total ?? 0), 0)
  const totalGanado = filtered.filter(q => q.status === 'won').reduce((s, q) => s + Number(q.total ?? 0), 0)
  const eficiencia = totalCotizado > 0 ? Math.round((totalGanado / totalCotizado) * 100) : 0

  // Chart data
  const chartData = useMemo(() => {
    if (period === 'day') {
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (29 - i))
        const dateStr = d.toISOString().slice(0, 10)
        const dq = filtered.filter(q => qDate(q).dateStr === dateStr)
        return {
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          ganadas: dq.filter(q => q.status === 'won').length,
          abiertas: dq.filter(q => q.status === 'open').length,
          perdidas: dq.filter(q => q.status === 'lost').length,
          _qs: dq,
        }
      })
    }
    if (period === 'year') {
      return Array.from({ length: 3 }, (_, i) => {
        const y = currentYear - (2 - i)
        const yq = filtered.filter(q => qDate(q).y === y)
        return {
          label: String(y),
          ganadas: yq.filter(q => q.status === 'won').length,
          abiertas: yq.filter(q => q.status === 'open').length,
          perdidas: yq.filter(q => q.status === 'lost').length,
          _qs: yq,
        }
      })
    }
    // month (default)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(currentYear, now.getMonth() - (11 - i), 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const mq = filtered.filter(q => { const ym = qDate(q); return ym.y === y && ym.m === m })
      return {
        label: getMonthName(m).slice(0, 3),
        ganadas: mq.filter(q => q.status === 'won').length,
        abiertas: mq.filter(q => q.status === 'open').length,
        perdidas: mq.filter(q => q.status === 'lost').length,
        _qs: mq,
      }
    })
  }, [filtered, period, currentYear])

  function handleBarClick(data: { label: string; _qs: QuotationSummary[] } | null, barStatus: 'won' | 'lost' | 'open') {
    if (!data) return
    const qs = data._qs.filter(q => q.status === barStatus)
    if (qs.length === 0) return
    setDrill({ label: data.label, qs, status: barStatus })
  }

  const statusLabel = { won: 'Ganadas', lost: 'Perdidas', open: 'Abiertas' }
  const statusColor = { won: '#1B8A4B', lost: '#ef4444', open: '#3b82f6' }

  return (
    <div className="p-6 space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{getMonthName(currentMonth)} {currentYear}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Período */}
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {(['day', 'month', 'year'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 transition-colors"
                style={period === p
                  ? { background: '#1B8A4B', color: '#fff' }
                  : { background: '#fff', color: '#374151' }}
              >
                {p === 'day' ? 'Día' : p === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
          {/* Ejecutiva */}
          <select
            value={ejecutiva}
            onChange={e => setEjecutiva(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="all">Todas las ejecutivas</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Empresa */}
          {companies.length > 1 && (
            <select
              value={empresa}
              onChange={e => setEmpresa(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white"
            >
              <option value="all">Todas las empresas</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiTile('Abiertas', String(openCount), 'cotizaciones activas')}
        {kpiTile('Ganado este mes', formatCLP(wonThisMonth), `${wonCountThisMonth} negocios`, '#1B8A4B')}
        {kpiTile('Conversión mes', `${convRate}%`, `${thisMonth.length} en el mes`)}
        {kpiTile('Eficiencia global', `${eficiencia}%`, `${formatCLP(totalGanado)} / ${formatCLP(totalCotizado)}`)}
      </div>

      {/* Gráfico + tabla ejecutivas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            {period === 'day' ? 'Últimos 30 días' : period === 'month' ? 'Últimos 12 meses' : 'Por año'}
          </h2>
          <p className="text-xs text-gray-400 mb-4">Haz click en una barra para ver los negocios</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="ganadas" name="Ganadas" fill="#22c55e" radius={[3, 3, 0, 0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'won')}
                style={{ cursor: 'pointer' }}
              />
              <Bar
                dataKey="abiertas" name="Abiertas" fill="#3b82f6" radius={[3, 3, 0, 0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'open')}
                style={{ cursor: 'pointer' }}
              />
              <Bar
                dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[3, 3, 0, 0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'lost')}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla por ejecutiva */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Por ejecutiva</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Ejecutiva</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-500">Abiertas</th>
                <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>Ganadas</th>
                <th className="text-right px-3 py-2.5 font-medium text-red-500">Perdidas</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-500">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .map(p => {
                  const pq = filtered.filter(q => q.vendedor_id === p.id)
                  const won = pq.filter(q => q.status === 'won').length
                  const closed = pq.filter(q => q.status !== 'open').length
                  return {
                    name: p.name,
                    open: pq.filter(q => q.status === 'open').length,
                    won,
                    lost: pq.filter(q => q.status === 'lost').length,
                    conv: closed > 0 ? Math.round((won / closed) * 100) : 0,
                    total: pq.length,
                  }
                })
                .filter(v => v.total > 0)
                .sort((a, b) => b.won - a.won)
                .map(e => (
                  <tr key={e.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#1B8A4B' }}>
                          {e.name[0]}
                        </div>
                        <span className="text-sm">{e.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{e.open}</td>
                    <td className="px-3 py-2.5 text-right font-medium" style={{ color: '#1B8A4B' }}>{e.won}</td>
                    <td className="px-3 py-2.5 text-right text-red-500">{e.lost}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={e.conv >= 50
                          ? { background: '#f0fdf4', color: '#1B8A4B' }
                          : { background: '#fef2f2', color: '#dc2626' }}>
                        {e.conv}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down panel */}
      {drill && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor[drill.status!] }} />
              <h2 className="font-semibold text-gray-900">
                {statusLabel[drill.status!]} — {drill.label}
              </h2>
              <span className="text-sm text-gray-400">({drill.qs.length} negocios)</span>
            </div>
            <button onClick={() => setDrill(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Ejecutiva</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Empresa</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Monto</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {drill.qs
                  .sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0))
                  .map(q => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{q.client_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{q.vendedor_name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {q.company && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: '#e8faf2', color: '#1B8A4B' }}>
                            {q.company}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {formatCLP(Number(q.total ?? 0))}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {q.issue_date ? new Date(q.issue_date).toLocaleDateString('es-CL') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: statusColor[drill.status!] }}>
                    {formatCLP(drill.qs.reduce((s, q) => s + Number(q.total ?? 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
