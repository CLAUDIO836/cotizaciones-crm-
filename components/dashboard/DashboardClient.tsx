'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { formatCLP, getMonthName } from '@/lib/utils'
import type { QuotationSummary } from '@/lib/api'

type Period = 'today' | 'week' | 'month'
interface Profile { id: string; name: string }

function getDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function getIssueDate(q: QuotationSummary): string {
  if (q.issue_date) return q.issue_date.slice(0, 10)
  if (q.year && q.month) return `${q.year}-${String(q.month).padStart(2, '0')}-01`
  return ''
}

function getYM(q: QuotationSummary) {
  if (q.year && q.month) return { y: Number(q.year), m: Number(q.month) }
  if (q.issue_date) { const d = new Date(q.issue_date); return { y: d.getFullYear(), m: d.getMonth() + 1 } }
  return { y: 0, m: 0 }
}

function getWeekStart(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function periodLabel(period: Period) {
  if (period === 'today') return 'hoy'
  if (period === 'week') return 'esta semana'
  return 'este mes'
}

function inPeriod(q: QuotationSummary, period: Period, now: Date): boolean {
  const ds = getIssueDate(q)
  if (!ds) return false
  if (period === 'today') return ds === getDateStr(now)
  if (period === 'week') {
    const ws = getWeekStart(now)
    const qd = new Date(ds)
    return qd >= ws && qd <= now
  }
  const { y, m } = getYM(q)
  return y === now.getFullYear() && m === now.getMonth() + 1
}

function KpiBlock({ label: lbl, count, monto, color, bg }: {
  label: string; count: number; monto: number; color: string; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{lbl}</p>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold" style={{ color }}>{count}</span>
        <span className="text-sm text-gray-400 mb-0.5">negocios</span>
      </div>
      <div className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: bg, color }}>
        {formatCLP(monto)}
      </div>
    </div>
  )
}

interface DrillItem { label: string; qs: QuotationSummary[]; status: 'won' | 'lost' | 'open' }

export default function DashboardClient({
  quotations,
  profiles,
  companies,
}: {
  quotations: QuotationSummary[]
  profiles: Profile[]
  companies: string[]
}) {
  const [period, setPeriod] = useState<Period>('today')
  const [ejecutiva, setEjecutiva] = useState('all')
  const [empresa, setEmpresa] = useState('all')
  const [drill, setDrill] = useState<DrillItem | null>(null)

  const now = new Date()

  const filtered = useMemo(() =>
    quotations.filter(q => {
      if (ejecutiva !== 'all' && q.vendedor_id !== ejecutiva) return false
      if (empresa !== 'all' && q.company !== empresa) return false
      return true
    }),
    [quotations, ejecutiva, empresa],
  )

  // KPIs for selected period
  const periodQs = useMemo(() => filtered.filter(q => inPeriod(q, period, now)), [filtered, period])
  const wonQs    = periodQs.filter(q => q.status === 'won')
  const lostQs   = periodQs.filter(q => q.status === 'lost')
  const openQs   = periodQs.filter(q => q.status === 'open')
  const sum      = (qs: QuotationSummary[]) => qs.reduce((s, q) => s + Number(q.total ?? 0), 0)

  // Eficiencia global (all filtered)
  const totalCotizado = sum(filtered)
  const totalGanado   = sum(filtered.filter(q => q.status === 'won'))
  const eficiencia    = totalCotizado > 0 ? Math.round((totalGanado / totalCotizado) * 100) : 0

  // Chart data
  const chartData = useMemo(() => {
    if (period === 'today') {
      return Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (13 - i))
        const ds = getDateStr(d)
        const dq = filtered.filter(q => getIssueDate(q) === ds)
        return {
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          ganadas: dq.filter(q => q.status === 'won').length,
          abiertas: dq.filter(q => q.status === 'open').length,
          perdidas: dq.filter(q => q.status === 'lost').length,
          montoGanado: sum(dq.filter(q => q.status === 'won')),
          _qs: dq,
        }
      })
    }
    if (period === 'week') {
      return Array.from({ length: 8 }, (_, i) => {
        const ws = getWeekStart(new Date(now))
        ws.setDate(ws.getDate() - (7 - i) * 7)
        const we = new Date(ws)
        we.setDate(ws.getDate() + 6)
        const wq = filtered.filter(q => {
          const ds = getIssueDate(q)
          if (!ds) return false
          const qd = new Date(ds)
          return qd >= ws && qd <= we
        })
        return {
          label: `${ws.getDate()}/${ws.getMonth() + 1}`,
          ganadas: wq.filter(q => q.status === 'won').length,
          abiertas: wq.filter(q => q.status === 'open').length,
          perdidas: wq.filter(q => q.status === 'lost').length,
          montoGanado: sum(wq.filter(q => q.status === 'won')),
          _qs: wq,
        }
      })
    }
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const mq = filtered.filter(q => { const ym = getYM(q); return ym.y === y && ym.m === m })
      return {
        label: getMonthName(m).slice(0, 3),
        ganadas: mq.filter(q => q.status === 'won').length,
        abiertas: mq.filter(q => q.status === 'open').length,
        perdidas: mq.filter(q => q.status === 'lost').length,
        montoGanado: sum(mq.filter(q => q.status === 'won')),
        _qs: mq,
      }
    })
  }, [filtered, period])

  function handleBarClick(data: { label: string; _qs: QuotationSummary[] } | null, barStatus: 'won' | 'lost' | 'open') {
    if (!data) return
    const qs = data._qs.filter(q => q.status === barStatus)
    if (!qs.length) return
    setDrill({ label: data.label, qs, status: barStatus })
  }

  const statusColor = { won: '#1B8A4B', lost: '#ef4444', open: '#3b82f6' }
  const statusLabel = { won: 'Ganadas', lost: 'Perdidas', open: 'Abiertas' }
  const chartTitle  = period === 'today' ? 'Últimos 14 días' : period === 'week' ? 'Últimas 8 semanas' : 'Últimos 12 meses'

  const periodButtons = [
    { key: 'today' as Period, label: 'Hoy' },
    { key: 'week'  as Period, label: 'Semana' },
    { key: 'month' as Period, label: 'Mes' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {periodLabel(period)} · {now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {periodButtons.map(p => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setDrill(null) }}
                className="px-4 py-1.5 transition-colors"
                style={period === p.key
                  ? { background: '#1B8A4B', color: '#fff' }
                  : { background: '#fff', color: '#374151' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={ejecutiva}
            onChange={e => { setEjecutiva(e.target.value); setDrill(null) }}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="all">Todas las ejecutivas</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {companies.length > 1 && (
            <select
              value={empresa}
              onChange={e => { setEmpresa(e.target.value); setDrill(null) }}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white"
            >
              <option value="all">Todas las empresas</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPI cards del período seleccionado */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-medium">
          Gestión {periodLabel(period)}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiBlock label="Ganadas" count={wonQs.length} monto={sum(wonQs)} color="#1B8A4B" bg="#f0fdf4" />
          <KpiBlock label="Abiertas" count={openQs.length} monto={sum(openQs)} color="#3b82f6" bg="#eff6ff" />
          <KpiBlock label="Perdidas" count={lostQs.length} monto={sum(lostQs)} color="#ef4444" bg="#fef2f2" />
        </div>
      </div>

      {/* Eficiencia global */}
      <div className="bg-white rounded-xl border p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Eficiencia global</p>
          <p className="text-2xl font-bold mt-1" style={{ color: eficiencia >= 50 ? '#1B8A4B' : '#f59e0b' }}>{eficiencia}%</p>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-xs text-gray-400">Total cotizado</p>
            <p className="text-lg font-bold text-gray-700">{formatCLP(totalCotizado)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total ganado</p>
            <p className="text-lg font-bold" style={{ color: '#1B8A4B' }}>{formatCLP(totalGanado)}</p>
          </div>
        </div>
      </div>

      {/* Gráfico + tabla ejecutivas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-1">{chartTitle}</h2>
          <p className="text-xs text-gray-400 mb-4">Barras = cantidad · Línea = monto ganado · Click para ver detalle</p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload?.length) return null
                  return (
                    <div className="bg-white border rounded-lg shadow p-3 text-xs">
                      <p className="font-semibold mb-1 text-gray-700">{label}</p>
                      {payload.map((e) => (
                        <p key={e.name} style={{ color: e.color }}>
                          {e.name}: {e.name === 'Monto ganado' ? formatCLP(Number(e.value)) : e.value}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="ganadas" name="Ganadas" fill="#22c55e" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'won')} style={{ cursor: 'pointer' }} />
              <Bar yAxisId="left" dataKey="abiertas" name="Abiertas" fill="#3b82f6" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'open')} style={{ cursor: 'pointer' }} />
              <Bar yAxisId="left" dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { label: string; _qs: QuotationSummary[] }, 'lost')} style={{ cursor: 'pointer' }} />
              <Line yAxisId="right" type="monotone" dataKey="montoGanado" name="Monto ganado"
                stroke="#1B8A4B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla por ejecutiva */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Por ejecutiva <span className="text-xs text-gray-400 font-normal ml-1 capitalize">({periodLabel(period)})</span>
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Ejecutiva</th>
                <th className="text-right px-3 py-2.5 font-medium text-blue-500">Ab.</th>
                <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>Gan.</th>
                <th className="text-right px-3 py-2.5 font-medium text-red-500">Perd.</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-500">Monto gan.</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .map(p => {
                  const pqs = periodQs.filter(q => q.vendedor_id === p.id)
                  return {
                    name: p.name,
                    open: pqs.filter(q => q.status === 'open').length,
                    won: pqs.filter(q => q.status === 'won').length,
                    lost: pqs.filter(q => q.status === 'lost').length,
                    monto: sum(pqs.filter(q => q.status === 'won')),
                    total: pqs.length,
                  }
                })
                .filter(v => v.total > 0)
                .sort((a, b) => b.won - a.won || b.monto - a.monto)
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
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700 text-xs">{e.monto > 0 ? formatCLP(e.monto) : '—'}</td>
                  </tr>
                ))}
              {profiles.every(p => !periodQs.find(q => q.vendedor_id === p.id)) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                    Sin actividad {periodLabel(period)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down panel */}
      {drill && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor[drill.status] }} />
              <h2 className="font-semibold text-gray-900">
                {statusLabel[drill.status]} — {drill.label}
              </h2>
              <span className="text-sm text-gray-400">
                ({drill.qs.length} negocios · {formatCLP(drill.qs.reduce((s, q) => s + Number(q.total ?? 0), 0))})
              </span>
            </div>
            <button onClick={() => setDrill(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Ejecutiva</th>
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
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCLP(Number(q.total ?? 0))}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {q.issue_date ? new Date(q.issue_date).toLocaleDateString('es-CL') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: statusColor[drill.status] }}>
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
