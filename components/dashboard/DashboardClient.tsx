'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Legend, ResponsiveContainer,
} from 'recharts'
import { formatCLP, getMonthName } from '@/lib/utils'
import type { QuotationSummary } from '@/lib/api'

interface Profile { id: string; name: string }

// ── Calendario inline ──────────────────────────────────────────────────────────
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DOW = ['L','M','M','J','V','S','D']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateStr(y: number, m: number, d: number) { return `${y}-${fmt2(m)}-${fmt2(d)}` }

function CalendarPicker({
  start, end, todayStr, availableYears,
  onChange,
}: {
  start: string; end: string; todayStr: string; availableYears: number[]
  onChange: (s: string, e: string) => void
}) {
  const initD = new Date(start + 'T12:00:00')
  const [vy, setVy] = useState(initD.getFullYear())
  const [vm, setVm] = useState(initD.getMonth() + 1)
  const [picking, setPicking] = useState(false)   // true = esperando segundo clic
  const [hover, setHover] = useState<string | null>(null)

  function prevM() { vm === 1 ? (setVy(y=>y-1), setVm(12)) : setVm(m=>m-1) }
  function nextM() { vm === 12 ? (setVy(y=>y+1), setVm(1))  : setVm(m=>m+1) }

  function clickDay(day: string) {
    if (!picking) {
      onChange(day, day)
      setPicking(true)
    } else {
      const [s, e] = day >= start ? [start, day] : [day, start]
      onChange(s, e)
      setPicking(false)
      setHover(null)
    }
  }

  // effective end while hovering
  const effEnd = picking && hover
    ? (hover >= start ? hover : start)
    : end
  const effStart = picking && hover && hover < start ? hover : start

  function inRange(day: string) { return day >= effStart && day <= effEnd }

  // Build grid
  const firstDow = new Date(vy, vm - 1, 1).getDay()   // 0=Sun
  const offset = firstDow === 0 ? 6 : firstDow - 1    // Mon-first
  const totalDays = new Date(vy, vm, 0).getDate()
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= totalDays; d++) cells.push(dateStr(vy, vm, d))

  // Quick selects
  const now = new Date(todayStr + 'T12:00:00')
  function qToday() { onChange(todayStr, todayStr); setPicking(false) }
  function qWeek() {
    const dow = now.getDay(); const diff = dow === 0 ? -6 : 1 - dow
    const mon = new Date(now); mon.setDate(now.getDate() + diff)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const s = dateStr(mon.getFullYear(), mon.getMonth()+1, mon.getDate())
    const e = dateStr(sun.getFullYear(), sun.getMonth()+1, sun.getDate())
    onChange(s, e > todayStr ? todayStr : e); setPicking(false)
  }
  function qMonth() {
    const s = dateStr(vy, vm, 1)
    const last = new Date(vy, vm, 0)
    const e = dateStr(last.getFullYear(), last.getMonth()+1, last.getDate())
    onChange(s, e > todayStr ? todayStr : e); setPicking(false)
  }

  return (
    <div className="bg-white rounded-xl border shadow-lg p-3 select-none" style={{ width: 272 }}>
      {/* Nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevM} className="p-1.5 rounded-lg hover:bg-gray-100 text-lg leading-none text-gray-500">‹</button>
        <div className="flex gap-1">
          <select value={vm} onChange={e => setVm(Number(e.target.value))}
            className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer pr-1">
            {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <select value={vy} onChange={e => setVy(Number(e.target.value))}
            className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={nextM} className="p-1.5 rounded-lg hover:bg-gray-100 text-lg leading-none text-gray-500">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map((d, i) => <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const inR  = inRange(day)
          const isS  = day === effStart
          const isE  = day === effEnd
          const isTd = day === todayStr
          return (
            <button key={day}
              onClick={() => clickDay(day)}
              onMouseEnter={() => picking && setHover(day)}
              onMouseLeave={() => picking && setHover(null)}
              className="relative text-sm py-1.5 transition-colors"
              style={{
                background: (isS || isE) ? '#1B8A4B' : inR ? '#d1fae5' : 'transparent',
                color: (isS || isE) ? '#fff' : '#111827',
                borderRadius: isS && isE ? 8 : isS ? '8px 0 0 8px' : isE ? '0 8px 8px 0' : 0,
                fontWeight: isTd ? 700 : 400,
              }}>
              {day.slice(8)}
              {isTd && !inR && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Quick shortcuts */}
      <div className="flex gap-1 mt-2.5 pt-2 border-t border-gray-100">
        {([['Hoy', qToday], ['Esta semana', qWeek], ['Este mes', qMonth]] as [string, ()=>void][]).map(([l, fn]) => (
          <button key={l} onClick={fn}
            className="flex-1 text-xs py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
            {l}
          </button>
        ))}
      </div>
      {picking && (
        <p className="text-xs text-center text-green-600 mt-1.5">Haz clic en el día final del rango</p>
      )}
    </div>
  )
}

// Convierte un timestamp UTC del servidor a fecha Chile (UTC-3)
function utcToChileDate(isoUtc: string): string {
  const d = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// Fecha local del browser en formato YYYY-MM-DD (no toISOString — ese da UTC)
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toDateStr(d: Date) { return localDateStr(d) }

// Parsea "YYYY-MM-DD" como fecha local (new Date("YYYY-MM-DD") la trata como UTC)
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Fecha de creación (para "abiertas" — cuándo se abrió la cotización)
function getCreatedDate(q: QuotationSummary): string {
  if (q.created_at) return utcToChileDate(q.created_at)
  if (q.issue_date) return q.issue_date.slice(0, 10)
  return ''
}

// Fecha de último cambio de estado (para "ganadas"/"perdidas" — cuándo cambió)
// Fallback a issue_date/created_at para históricos importados desde Pipedrive sin log de estado
function getStatusDate(q: QuotationSummary): string {
  if (q.updated_at) return utcToChileDate(q.updated_at)
  if (q.issue_date) return q.issue_date.slice(0, 10)
  if (q.created_at) return utcToChileDate(q.created_at)
  return ''
}

// Fecha de actividad por status:
// - abiertas  → cuándo se creó el negocio (created_at > issue_date)
// - ganadas/perdidas → cuándo cambió el estado (updated_at del log)
function getActivityDate(q: QuotationSummary): string {
  if (q.status === 'open') return getCreatedDate(q)
  return getStatusDate(q)
}

// Fecha del servicio: fecha_salida si existe, si no issue_date, si no created_at
function getServiceDate(q: QuotationSummary): string {
  if (q.fecha_salida) return q.fecha_salida.slice(0, 10)
  if (q.issue_date)   return q.issue_date.slice(0, 10)
  return getCreatedDate(q)
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
  const todayStr = toDateStr(now)

  const [calStart,  setCalStart]  = useState(todayStr)
  const [calEnd,    setCalEnd]    = useState(todayStr)
  const [showCal,   setShowCal]   = useState(false)
  const [ejecutiva, setEjecutiva] = useState('all')
  const [empresa,   setEmpresa]   = useState('all')
  const [drill,     setDrill]     = useState<DrillItem | null>(null)
  const calRef = useRef<HTMLDivElement>(null)

  // Cerrar calendario al hacer clic fuera
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const range = useMemo((): { from: string; to: string } => (
    { from: calStart, to: calEnd }
  ), [calStart, calEnd])

  // Base filter (ejecutiva + empresa)
  const filtered = useMemo(() =>
    quotations.filter(q => {
      if (ejecutiva !== 'all' && q.vendedor_id !== ejecutiva) return false
      if (empresa   !== 'all' && q.company       !== empresa)   return false
      return true
    }),
    [quotations, ejecutiva, empresa],
  )

  // inRange usa getActivityDate: abiertas por fecha servicio, ganadas/perdidas por fecha estado
  const inRange = useMemo(() => {
    const { from, to } = range
    return filtered.filter(q => { const ds = getActivityDate(q); return ds >= from && ds <= to })
  }, [filtered, range])

  // Los tres KPIs miden gestión real: abiertas por created_at, ganadas/perdidas por updated_at
  const wonInRange  = inRange.filter(q => q.status === 'won')
  const openInRange = inRange.filter(q => q.status === 'open')
  const lostInRange = inRange.filter(q => q.status === 'lost')

  // Creadas en el rango (por fecha de creación, independiente del estado actual)
  const createdInRange = useMemo(() => {
    const { from, to } = range
    return filtered.filter(q => { const ds = getCreatedDate(q); return ds >= from && ds <= to })
  }, [filtered, range])

  // Eficiencia del período seleccionado (no histórico global)
  const totalCotizado = sum(inRange)
  const totalGanado   = sum(wonInRange)
  const eficiencia    = totalCotizado > 0 ? Math.round((totalGanado / totalCotizado) * 100) : 0

  // Chart granularity (auto based on range)
  const days = daysBetween(range.from, range.to)
  const gran: 'day' | 'week' | 'month' = days <= 31 ? 'day' : days <= 93 ? 'week' : 'month'

  // Build chart series
  const chartData = useMemo(() => {
    const { from, to } = range
    const fromD = parseDateLocal(from)   // parse como fecha local, no UTC
    const toD   = parseDateLocal(to)

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
        const wq = filtered.filter(q => { const ds = getActivityDate(q); return ds >= localDateStr(ws) && ds <= localDateStr(we) })
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
      const dStr  = localDateStr(cur)
      const nextM = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const nStr  = localDateStr(nextM)
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

  const rangeDescription = calStart === calEnd
    ? (calStart === todayStr ? 'hoy' : calStart)
    : `${calStart} → ${calEnd}`

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    quotations.forEach(q => { if (q.year) years.add(q.year) })
    return [...years].sort((a, b) => b - a)
  }, [quotations, now])

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

          {/* ── Selector de período (abre calendario) ── */}
          <div ref={calRef} className="relative">
            <button
              onClick={() => setShowCal(v => !v)}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              style={showCal ? { borderColor: '#1B8A4B', color: '#1B8A4B' } : {}}>
              📅 <span>{rangeDescription}</span>
            </button>
            {showCal && (
              <div className="absolute right-0 top-full mt-1 z-50">
                <CalendarPicker
                  start={calStart} end={calEnd}
                  todayStr={todayStr}
                  availableYears={availableYears}
                  onChange={(s, e) => { setCalStart(s); setCalEnd(e); setDrill(null) }}
                />
              </div>
            )}
          </div>

          {/* Ejecutiva */}
          <select value={ejecutiva}
            onChange={e => { setEjecutiva(e.target.value); setDrill(null) }}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white">
            <option value="all">Todas las ejecutivas</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Empresa */}
          {companies.length > 1 && (
            <select value={empresa}
              onChange={e => { setEmpresa(e.target.value); setDrill(null) }}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 bg-white">
              <option value="all">Todas las empresas</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── KPIs del rango ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
            Gestión {rangeDescription}
          </p>
          {/* Botones rápidos de mes */}
          <div className="flex flex-wrap gap-1">
            {MONTH_NAMES.map((name, idx) => {
              const m = idx + 1
              const y = now.getFullYear()
              const firstDay = `${y}-${String(m).padStart(2, '0')}-01`
              const lastDate = new Date(y, m, 0)
              const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
              const clampedEnd = lastDay > todayStr ? todayStr : lastDay
              const isActive = calStart === firstDay && calEnd === clampedEnd
              // Solo mostrar meses hasta el actual
              if (m > now.getMonth() + 1) return null
              return (
                <button
                  key={m}
                  onClick={() => { setCalStart(firstDay); setCalEnd(clampedEnd); setDrill(null) }}
                  className="text-xs px-2 py-1 rounded-md border transition-colors"
                  style={isActive
                    ? { background: '#1B8A4B', color: '#fff', borderColor: '#1B8A4B', fontWeight: 700 }
                    : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }
                  }
                >
                  {name.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Creadas" count={createdInRange.length} monto={sum(createdInRange)} color="#6b7280" bg="#f3f4f6" />
          <KpiCard label="Ganadas" count={wonInRange.length} monto={sum(wonInRange)} color="#1B8A4B" bg="#f0fdf4" />
          <KpiCard label="Abiertas" count={openInRange.length} monto={sum(openInRange)} color="#3b82f6" bg="#eff6ff" />
          <KpiCard label="Perdidas" count={lostInRange.length} monto={sum(lostInRange)} color="#ef4444" bg="#fef2f2" />
        </div>
      </div>

      {/* ── Eficiencia ── */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Eficiencia del período</p>
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
                <th className="text-right px-3 py-2.5 font-medium text-blue-500">Ab.</th>
                <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>Gan.</th>
                <th className="text-right px-3 py-2.5 font-medium text-red-500">Perd.</th>
                <th className="text-right px-3 py-2.5 font-medium text-blue-400">$ Ab.</th>
                <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>$ Gan.</th>
                <th className="text-right px-3 py-2.5 font-medium text-red-400">$ Perd.</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .map(p => {
                  const pqs = inRange.filter(q => q.vendedor_id === p.id)
                  const wonQ  = pqs.filter(q => q.status === 'won')
                  const lostQ = pqs.filter(q => q.status === 'lost')
                  const openQ = pqs.filter(q => q.status === 'open')
                  return {
                    name:      p.name,
                    open:      openQ.length,
                    won:       wonQ.length,
                    lost:      lostQ.length,
                    montoGan:  sum(wonQ),
                    montoPerd: sum(lostQ),
                    montoAb:   sum(openQ),
                    total:     pqs.length,
                  }
                })
                .filter(v => v.total > 0)
                .sort((a, b) => b.won - a.won || b.montoGan - a.montoGan)
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
                    <td className="px-3 py-2.5 text-right text-xs text-blue-500">
                      {e.montoAb > 0 ? formatCLP(e.montoAb) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium" style={{ color: '#1B8A4B' }}>
                      {e.montoGan > 0 ? formatCLP(e.montoGan) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-red-500">
                      {e.montoPerd > 0 ? formatCLP(e.montoPerd) : '—'}
                    </td>
                  </tr>
                ))}
              {profiles.every(p => !inRange.find(q => q.vendedor_id === p.id)) && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                    Sin actividad en el período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Por cliente ── */}
      {(() => {
        // Agrupar por RUT (identificador único); si no hay RUT, por client_id
        const map = new Map<string, {
          key: string; name: string; rut: string | null
          won: number; lost: number; open: number
          montoGan: number; montoPerd: number; montoAb: number
          qs: QuotationSummary[]
        }>()
        inRange.forEach(q => {
          const rut  = q.client_rut?.trim() || null
          const key  = rut ?? q.client_id ?? q.client_name ?? 'Sin cliente'
          const name = q.client_name ?? 'Sin cliente'
          if (!map.has(key)) map.set(key, { key, name, rut, won:0, lost:0, open:0, montoGan:0, montoPerd:0, montoAb:0, qs:[] })
          const e = map.get(key)!
          e.qs.push(q)
          if (q.status === 'won')  { e.won++;  e.montoGan  += Number(q.total ?? 0) }
          if (q.status === 'lost') { e.lost++; e.montoPerd += Number(q.total ?? 0) }
          if (q.status === 'open') { e.open++; e.montoAb   += Number(q.total ?? 0) }
        })
        const rows = [...map.values()].sort((a, b) => b.montoGan - a.montoGan || b.won - a.won)
        if (!rows.length) return null
        const best = rows[0]
        return (
          <>
            {/* Mejor cliente del mes */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">🏆 Mejor cliente — {rangeDescription}</p>
                <p className="text-xl font-black text-gray-900 truncate">{best.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{best.won} negocio{best.won !== 1 ? 's' : ''} ganado{best.won !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black" style={{ color: '#1B8A4B' }}>{formatCLP(best.montoGan)}</p>
                <p className="text-xs text-gray-400 mt-0.5">monto ganado</p>
              </div>
            </div>

            {/* Tabla clientes */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Por cliente
                  <span className="text-xs text-gray-400 font-normal ml-2">({rangeDescription})</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cliente</th>
                      <th className="text-right px-3 py-2.5 font-medium text-blue-500">Ab.</th>
                      <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>Gan.</th>
                      <th className="text-right px-3 py-2.5 font-medium text-red-500">Perd.</th>
                      <th className="text-right px-3 py-2.5 font-medium text-blue-400">$ Ab.</th>
                      <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#1B8A4B' }}>$ Gan.</th>
                      <th className="text-right px-3 py-2.5 font-medium text-red-400">$ Perd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(e => (
                      <tr key={e.key} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <p className="font-medium text-gray-900 truncate">{e.name}</p>
                          {e.rut
                            ? <p className="text-xs text-gray-400">{e.rut}</p>
                            : <p className="text-xs text-amber-500 font-medium">Sin RUT</p>
                          }
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-600">{e.open || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#1B8A4B' }}>{e.won || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{e.lost || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-blue-500">{e.montoAb > 0 ? formatCLP(e.montoAb) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium" style={{ color: '#1B8A4B' }}>{e.montoGan > 0 ? formatCLP(e.montoGan) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-red-500">{e.montoPerd > 0 ? formatCLP(e.montoPerd) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      })()}

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
