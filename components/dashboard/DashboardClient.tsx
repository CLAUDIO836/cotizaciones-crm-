'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Legend, ResponsiveContainer,
} from 'recharts'
import { formatCLP, getMonthName } from '@/lib/utils'
import type { QuotationSummary } from '@/lib/api'

interface Profile { id: string; name: string }
type Preset = 'today' | 'week' | 'month' | 'custom'

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

// Fecha de creación (para "abiertas" — cuándo se abrió la cotización)
function getCreatedDate(q: QuotationSummary): string {
  if (q.created_at) return q.created_at.slice(0, 10)
  if (q.issue_date) return q.issue_date.slice(0, 10)
  return ''
}

// Fecha de último cambio de estado (para "ganadas"/"perdidas" — cuándo cambió)
function getStatusDate(q: QuotationSummary): string {
  if (q.updated_at) return q.updated_at.slice(0, 10)
  if (q.created_at) return q.created_at.slice(0, 10)
  if (q.issue_date) return q.issue_date.slice(0, 10)
  return ''
}

// Para el gráfico de tendencia usamos la fecha de gestión correcta por status
function getActivityDate(q: QuotationSummary): string {
  if (q.status === 'open') return getCreatedDate(q)
  return getStatusDate(q)
}

function getWeekStart(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
}

function sum(qs: QuotationSummary[]) {
  return qs.reduce((s, q) => s + Number(q.total ?? 0), 0)
}

function formatLabel(d: Date, gran: 'day' | 'week' | 'month') {
  if (gran === 'month') return getMonthName(d.getMonth() + 1).slice(0, 3) + ' ' + String(d.getFullYear()).slice(2)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontSize: 12 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#111' }}>{label}</p>
      {payload.map(e => (
        <p key={e.name} style={{ margin: '2px 0', color: e.color }}>
          {e.name}: {e.name === 'Monto gan.' ? formatCLP(e.value) : e.value}
        </p>
      ))}
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, count, monto, color, bg }: {
  label: string; count: number; monto: number; color: string; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black" style={{ color }}>{count}</span>
        <span className="text-sm text-gray-400 mb-1">negocio{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: bg, color }}>
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
  const now = new Date()
  const todayStr  = toDateStr(now)
  const weekStart = toDateStr(getWeekStart(now))
  const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  const [preset, setPreset]       = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState(monthStart)
  const [customTo,   setCustomTo]   = useState(todayStr)
  const [ejecutiva, setEjecutiva] = useState('all')
  const [empresa,   setEmpresa]   = useState('all')
  const [drill,     setDrill]     = useState<DrillItem | null>(null)

  // Active date range
  const range = useMemo((): { from: string; to: string } => {
    if (preset === 'today')  return { from: todayStr,   to: todayStr }
    if (preset === 'week')   return { from: weekStart,  to: todayStr }
    if (preset === 'month')  return { from: monthStart, to: todayStr }
    return { from: customFrom, to: customTo }
  }, [preset, customFrom, customTo, todayStr, weekStart, monthStart])

  // Base filter (ejecutiva + empresa)
  const filtered = useMemo(() =>
    quotations.filter(q => {
      if (ejecutiva !== 'all' && q.vendedor_id !== ejecutiva) return false
      if (empresa   !== 'all' && q.company       !== empresa)   return false
      return true
    }),
    [quotations, ejecutiva, empresa],
  )

  // Cotizaciones con actividad en el rango:
  // - abiertas: creadas en el rango (created_at)
  // - ganadas/perdidas: estado cambiado en el rango (updated_at / crm_updated_at)
  const inRange = useMemo(() => {
    const { from, to } = range
    return filtered.filter(q => {
      const ds = getActivityDate(q)
      return ds >= from && ds <= to
    })
  }, [filtered, range])

  // Los tres KPIs miden gestión real: abiertas por created_at, ganadas/perdidas por updated_at
  const wonInRange  = inRange.filter(q => q.status === 'won')
  const openInRange = inRange.filter(q => q.status === 'open')
  const lostInRange = inRange.filter(q => q.status === 'lost')

  // Eficiencia (all filtered)
  const totalCotizado = sum(filtered)
  const totalGanado   = sum(filtered.filter(q => q.status === 'won'))
  const eficiencia    = totalCotizado > 0 ? Math.round((totalGanado / totalCotizado) * 100) : 0

  // Chart granularity (auto based on range)
  const days = daysBetween(range.from, range.to)
  const gran: 'day' | 'week' | 'month' = days <= 31 ? 'day' : days <= 93 ? 'week' : 'month'

  // Build chart series
  const chartData = useMemo(() => {
    const { from, to } = range
    const fromD = new Date(from)
    const toD   = new Date(to)

    if (gran === 'day') {
      const result = []
      const cur = new Date(fromD)
      while (cur <= toD) {
        const ds = toDateStr(cur)
        const dq = filtered.filter(q => getActivityDate(q) === ds)
        result.push({
          label: formatLabel(cur, 'day'),
          Ganadas:  dq.filter(q => q.status === 'won').length,
          Abiertas: dq.filter(q => q.status === 'open').length,
          Perdidas: dq.filter(q => q.status === 'lost').length,
          'Monto gan.': sum(dq.filter(q => q.status === 'won')),
          _qs: dq,
        })
        cur.setDate(cur.getDate() + 1)
      }
      return result
    }

    if (gran === 'week') {
      const result = []
      const ws = getWeekStart(new Date(fromD))
      while (ws <= toD) {
        const we = new Date(ws); we.setDate(ws.getDate() + 6)
        const wq = filtered.filter(q => { const ds = getActivityDate(q); return ds >= toDateStr(ws) && ds <= toDateStr(we) })
        result.push({
          label: formatLabel(ws, 'week'),
          Ganadas:  wq.filter(q => q.status === 'won').length,
          Abiertas: wq.filter(q => q.status === 'open').length,
          Perdidas: wq.filter(q => q.status === 'lost').length,
          'Monto gan.': sum(wq.filter(q => q.status === 'won')),
          _qs: wq,
        })
        ws.setDate(ws.getDate() + 7)
      }
      return result
    }

    // month
    const result = []
    const cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1)
    while (cur <= toD) {
      const dStr  = toDateStr(cur)
      const nextM = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const nStr  = toDateStr(nextM)
      const mq = filtered.filter(q => { const ds = getActivityDate(q); return ds >= dStr && ds < nStr })
      result.push({
        label: formatLabel(cur, 'month'),
        Ganadas:  mq.filter(q => q.status === 'won').length,
        Abiertas: mq.filter(q => q.status === 'open').length,
        Perdidas: mq.filter(q => q.status === 'lost').length,
        'Monto gan.': sum(mq.filter(q => q.status === 'won')),
        _qs: mq,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return result
  }, [filtered, range, gran])

  function handleBarClick(data: { _qs: QuotationSummary[]; label: string } | null, status: 'won' | 'lost' | 'open') {
    if (!data) return
    const qs = data._qs.filter(q => q.status === status)
    if (!qs.length) return
    setDrill({ label: data.label, qs, status })
  }

  const statusColor = { won: '#1B8A4B', lost: '#ef4444', open: '#3b82f6' }
  const statusLabel = { won: 'Ganadas', lost: 'Perdidas', open: 'Abiertas' }

  const rangeDescription = preset === 'today' ? 'hoy'
    : preset === 'week'  ? 'esta semana'
    : preset === 'month' ? 'este mes'
    : `${range.from} → ${range.to}`

  const presets = [
    { key: 'today' as Preset,  label: 'Hoy' },
    { key: 'week'  as Preset,  label: 'Semana' },
    { key: 'month' as Preset,  label: 'Mes' },
    { key: 'custom' as Preset, label: 'Personalizado' },
  ]

  return (
    <div className="p-6 space-y-6">

      {/* ── Header + filtros ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Período preset */}
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {presets.map(p => (
              <button
                key={p.key}
                onClick={() => { setPreset(p.key); setDrill(null) }}
                className="px-3 py-1.5 transition-colors"
                style={preset === p.key
                  ? { background: '#1B8A4B', color: '#fff' }
                  : { background: '#fff', color: '#374151' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Ejecutiva */}
          <select
            value={ejecutiva}
            onChange={e => { setEjecutiva(e.target.value); setDrill(null) }}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="all">Todas las ejecutivas</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Empresa */}
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

      {/* ── Rango personalizado ── */}
      {preset === 'custom' && (
        <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-600">Rango de fechas:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Desde</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={e => { setCustomFrom(e.target.value); setDrill(null) }}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayStr}
              onChange={e => { setCustomTo(e.target.value); setDrill(null) }}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700"
              style={{ fontSize: 16 }}
            />
          </div>
          <span className="text-xs text-gray-400">
            {days} día{days !== 1 ? 's' : ''} · vista {gran === 'day' ? 'diaria' : gran === 'week' ? 'semanal' : 'mensual'}
          </span>
        </div>
      )}

      {/* ── KPIs del rango ── */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-medium">
          Gestión {rangeDescription}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="Ganadas" count={wonInRange.length} monto={sum(wonInRange)} color="#1B8A4B" bg="#f0fdf4" />
          {/* Abiertas = total actualmente abiertas, no filtrado por fecha */}
          <KpiCard label="Abiertas" count={openInRange.length} monto={sum(openInRange)} color="#3b82f6" bg="#eff6ff" />
          <KpiCard label="Perdidas" count={lostInRange.length} monto={sum(lostInRange)} color="#ef4444" bg="#fef2f2" />
        </div>
      </div>

      {/* ── Eficiencia ── */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Eficiencia global</p>
          <p className="text-3xl font-black mt-1" style={{ color: eficiencia >= 50 ? '#1B8A4B' : '#f59e0b' }}>{eficiencia}%</p>
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

      {/* ── Gráfico + tabla ejecutivas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfico */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            Tendencia — vista {gran === 'day' ? 'diaria' : gran === 'week' ? 'semanal' : 'mensual'}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Barras = cantidad de cotizaciones · Línea = monto ganado · Click en barra para ver detalle
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 0, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }}
                tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v)} />
              <CustomTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="Ganadas"  fill="#22c55e" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { _qs: QuotationSummary[]; label: string }, 'won')} style={{ cursor: 'pointer' }} />
              <Bar yAxisId="left" dataKey="Abiertas" fill="#3b82f6" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { _qs: QuotationSummary[]; label: string }, 'open')} style={{ cursor: 'pointer' }} />
              <Bar yAxisId="left" dataKey="Perdidas" fill="#ef4444" radius={[3,3,0,0]}
                onClick={(d) => handleBarClick(d as unknown as { _qs: QuotationSummary[]; label: string }, 'lost')} style={{ cursor: 'pointer' }} />
              <Line yAxisId="right" type="monotone" dataKey="Monto gan." stroke="#1B8A4B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla por ejecutiva */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Por ejecutiva
              <span className="text-xs text-gray-400 font-normal ml-2">({rangeDescription})</span>
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Ejecutiva</th>
                <th className="text-right px-3 py-2.5 font-medium text-blue-500">Abiertas</th>
                <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>Gan.</th>
                <th className="text-right px-3 py-2.5 font-medium text-red-500">Perd.</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-400">Monto gan.</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .map(p => {
                  const pqs = inRange.filter(q => q.vendedor_id === p.id)
                  return {
                    name:  p.name,
                    open:  pqs.filter(q => q.status === 'open').length,
                    won:   pqs.filter(q => q.status === 'won').length,
                    lost:  pqs.filter(q => q.status === 'lost').length,
                    monto: sum(pqs.filter(q => q.status === 'won')),
                    total: pqs.length,
                  }
                })
                .filter(v => v.total > 0)
                .sort((a, b) => b.won - a.won || b.monto - a.monto)
                .map(e => (
                  <tr key={e.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#1B8A4B' }}>
                          {e.name[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{e.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{e.open}</td>
                    <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#1B8A4B' }}>{e.won}</td>
                    <td className="px-3 py-2.5 text-right text-red-500">{e.lost}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-700">
                      {e.monto > 0 ? formatCLP(e.monto) : '—'}
                    </td>
                  </tr>
                ))}
              {profiles.every(p => !inRange.find(q => q.vendedor_id === p.id)) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                    Sin actividad en el período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Drill-down ── */}
      {drill && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ background: statusColor[drill.status] }} />
              <h2 className="font-semibold text-gray-900">
                {statusLabel[drill.status]} — {drill.label}
              </h2>
              <span className="text-sm text-gray-400">
                {drill.qs.length} negocio{drill.qs.length !== 1 ? 's' : ''} · {formatCLP(sum(drill.qs))}
              </span>
            </div>
            <button onClick={() => setDrill(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
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
                      <td className="px-4 py-2.5 text-right font-medium">{formatCLP(Number(q.total ?? 0))}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {q.issue_date ? new Date(q.issue_date).toLocaleDateString('es-CL') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 font-semibold text-gray-700 text-sm">Total</td>
                  <td className="px-4 py-2.5 text-right font-black" style={{ color: statusColor[drill.status] }}>
                    {formatCLP(sum(drill.qs))}
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
