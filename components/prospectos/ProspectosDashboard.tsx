'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Phone, PhoneCall, Clock, Target, TrendingUp, ArrowLeft,
  ChevronDown, ChevronUp, Play, Pencil, Check, X,
} from 'lucide-react'
import { Campaign } from '@/lib/prospectos-types'
import { UserSession } from '@/lib/api'

const STORAGE_KEY = 'crm_daily_call_goal'
const DEFAULT_GOAL = 36

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  total: number
  answered: number
  pct_answered: number
  total_seconds: number
}

interface DailyRow {
  date: string
  total: number
  answered: number
  total_seconds: number
  pct_answered: number
}

interface ExecRow {
  user_id: string
  executive_name: string
  total: number
  answered: number
  pct_answered: number
  total_seconds: number
  days_active: number
  daily_avg: number
}

interface CommuneRow {
  commune: string
  total: number
  answered: number
  pct_answered: number
  prospects_called: number
  total_prospects: number
  coverage_pct: number
}

interface TopProspect {
  prospect_id: string
  prospect_name: string
  commune: string
  status: string
  total_calls: number
  answered: number
  avg_duration: number | null
  best_recording: string | null
}

interface DashboardData {
  summary: Summary
  daily: DailyRow[]
  executive_stats: ExecRow[]
  commune_stats: CommuneRow[]
  top_prospects: TopProspect[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtHours(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${(sec / 3600).toFixed(1)}h`
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthRange(year: number, month: number) {
  const m = String(month).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${m}-01`,
    to:   `${year}-${m}-${String(last).padStart(2, '0')}`,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = '#1B8A4B' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
        style={{ background: color }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function GoalBar({ exec, goal }: { exec: ExecRow; goal: number }) {
  const pct = Math.min(100, Math.round((exec.daily_avg / goal) * 100))
  const color = pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-800">{exec.executive_name}</span>
        <span className="text-xs text-gray-500 tabular-nums">
          {exec.daily_avg.toFixed(1)} / {goal} por día · {exec.total} total
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function CommuneBadge({ row }: { row: CommuneRow }) {
  const grade = row.pct_answered >= 50 ? '🟢' : row.pct_answered >= 25 ? '🟡' : '🔴'
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <span className="text-base w-5">{grade}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{row.commune}</span>
          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
            {row.answered}/{row.total} contestadas
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500"
              style={{ width: `${row.pct_answered}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-16 text-right">
            {row.coverage_pct}% cobertura
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProspectosDashboard({
  campaign, user, isAdmin, executives,
}: {
  campaign: Campaign
  user: UserSession
  isAdmin: boolean
  executives: { id: string; name: string }[]
}) {
  const today = todayStr()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const { from: initFrom, to: initTo } = monthRange(year, month)

  const [dateFrom,   setDateFrom]   = useState(initFrom)
  const [dateTo,     setDateTo]     = useState(initTo)
  const [filterUser, setFilterUser] = useState('')
  const [filterComm, setFilterComm] = useState('')
  const [quickYear,  setQuickYear]  = useState(String(year))
  const [quickMonth, setQuickMonth] = useState(String(month))
  const [loading,    setLoading]    = useState(false)
  const [data,       setData]       = useState<DashboardData | null>(null)
  const [showDaily,  setShowDaily]  = useState(false)

  // Editable goal
  const [goal,       setGoal]       = useState(DEFAULT_GOAL)
  const [editGoal,   setEditGoal]   = useState(false)
  const [goalInput,  setGoalInput]  = useState(String(DEFAULT_GOAL))
  const goalRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) { setGoal(parseInt(stored)); setGoalInput(stored) }
    } catch { /* ignore */ }
  }, [])

  function saveGoal() {
    const v = parseInt(goalInput)
    if (isNaN(v) || v < 1) return
    setGoal(v)
    try { localStorage.setItem(STORAGE_KEY, String(v)) } catch { /* ignore */ }
    setEditGoal(false)
  }

  function applyQuick(y: string, m: string) {
    setQuickYear(y); setQuickMonth(m)
    if (!y) { setDateFrom(''); setDateTo(''); return }
    const yi = parseInt(y)
    if (m) {
      const { from, to } = monthRange(yi, parseInt(m))
      setDateFrom(from); setDateTo(to)
    } else {
      setDateFrom(`${yi}-01-01`); setDateTo(`${yi}-12-31`)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ campaign_id: campaign.id })
      if (dateFrom)   qs.set('date_from', dateFrom)
      if (dateTo)     qs.set('date_to', dateTo)
      if (filterUser) qs.set('user_id', filterUser)
      if (filterComm) qs.set('commune', filterComm)

      const res = await fetch(`/api/prospectos/${campaign.id}/dashboard?${qs}`)
      const json = await res.json()
      setData(json.data ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [campaign.id, dateFrom, dateTo, filterUser, filterComm])

  useEffect(() => { fetchData() }, [fetchData])

  const s = data?.summary

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/prospectos/${campaign.id}`}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: '#1B8A4B' }}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard de Llamadas</h1>
            <p className="text-sm text-gray-500">{campaign.name}</p>
          </div>
        </div>

        {/* Meta editable */}
        <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-2">
          <Target className="w-4 h-4 text-green-600" />
          <span className="text-sm text-gray-600">Meta diaria:</span>
          {editGoal ? (
            <>
              <input
                ref={goalRef}
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditGoal(false) }}
                className="w-14 text-sm font-bold text-center border-b-2 border-green-500 outline-none bg-transparent"
                autoFocus
              />
              <button onClick={saveGoal} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditGoal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-gray-900">{goal} llamadas</span>
              <button onClick={() => { setEditGoal(true); setGoalInput(String(goal)) }}
                className="text-gray-400 hover:text-gray-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => { setDateFrom(today); setDateTo(today); setQuickYear(''); setQuickMonth('') }}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              dateFrom === today && dateTo === today
                ? 'bg-green-600 text-white border-green-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            Hoy
          </button>
          <select value={quickYear} onChange={e => applyQuick(e.target.value, quickMonth)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
            <option value="">Año</option>
            {[year, year - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={quickMonth} onChange={e => applyQuick(quickYear, e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
            <option value="">Mes</option>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <span className="text-xs text-gray-400">al</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          {isAdmin && (
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
              <option value="">Todos los ejecutivos</option>
              {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          )}
          <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
            <option value="">Todas las comunas</option>
            {(data?.commune_stats ?? []).map(c => (
              <option key={c.commune} value={c.commune}>{c.commune}</option>
            ))}
          </select>
          {(filterUser || filterComm) && (
            <button onClick={() => { setFilterUser(''); setFilterComm('') }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
          Cargando datos...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Phone className="w-5 h-5" />}
              label="Llamadas totales" value={String(s?.total ?? 0)} />
            <StatCard icon={<PhoneCall className="w-5 h-5" />}
              label="Contestadas" value={String(s?.answered ?? 0)}
              sub={`${s?.pct_answered ?? 0}% efectividad`}
              color="#2563eb" />
            <StatCard icon={<Clock className="w-5 h-5" />}
              label="Tiempo total" value={fmtHours(s?.total_seconds ?? 0)}
              color="#7c3aed" />
            <StatCard icon={<Target className="w-5 h-5" />}
              label="Promedio diario" value={
                data.executive_stats.length > 0
                  ? (data.executive_stats.reduce((acc, e) => acc + e.daily_avg, 0) / data.executive_stats.length).toFixed(1)
                  : '0'
              }
              sub={`Meta: ${goal} por ejecutivo`}
              color="#d97706" />
          </div>

          {/* Meta por ejecutivo */}
          {data.executive_stats.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
                Progreso meta diaria por ejecutivo
                <span className="text-xs font-normal text-gray-400 ml-1">
                  ({goal} llamadas/día · promedio del período)
                </span>
              </h2>
              <div className="space-y-4">
                {data.executive_stats.map(exec => (
                  <GoalBar key={exec.user_id} exec={exec} goal={goal} />
                ))}
              </div>
            </div>
          )}

          {/* Tabla ejecutivos */}
          {isAdmin && data.executive_stats.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Detalle por ejecutivo</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                  <tr>
                    <th className="text-left px-5 py-3">Ejecutivo</th>
                    <th className="text-center px-3 py-3">Total</th>
                    <th className="text-center px-3 py-3">Contestadas</th>
                    <th className="text-center px-3 py-3">% Efect.</th>
                    <th className="text-center px-3 py-3">Días activo</th>
                    <th className="text-center px-3 py-3">Prom/día</th>
                    <th className="text-center px-3 py-3">T. total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.executive_stats.map(exec => {
                    const onGoal = exec.daily_avg >= goal
                    return (
                      <tr key={exec.user_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{exec.executive_name}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{exec.total}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-blue-600">{exec.answered}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{exec.pct_answered}%</td>
                        <td className="px-3 py-3 text-center tabular-nums">{exec.days_active}</td>
                        <td className={`px-3 py-3 text-center tabular-nums font-semibold ${onGoal ? 'text-green-600' : 'text-red-500'}`}>
                          {exec.daily_avg.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-500">
                          {fmtHours(exec.total_seconds)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Comunas */}
          {data.commune_stats.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-600" />
                Rendimiento por comuna
                <span className="text-xs font-normal text-gray-400 ml-1">
                  🟢 &gt;50% contestadas · 🟡 25–50% · 🔴 &lt;25%
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {data.commune_stats.map(c => (
                  <CommuneBadge key={c.commune} row={c} />
                ))}
              </div>
            </div>
          )}

          {/* Detalle diario (colapsable) */}
          {data.daily.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <button
                className="w-full px-5 py-4 flex items-center justify-between text-left"
                onClick={() => setShowDaily(v => !v)}>
                <h2 className="font-semibold text-gray-800">Detalle por día</h2>
                {showDaily ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showDaily && (
                <table className="w-full text-sm border-t">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                    <tr>
                      <th className="text-left px-5 py-3">Fecha</th>
                      <th className="text-center px-3 py-3">Total</th>
                      <th className="text-center px-3 py-3">Contestadas</th>
                      <th className="text-center px-3 py-3">% Efect.</th>
                      <th className="text-center px-3 py-3">T. llamadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map(row => {
                      const [y, m, d] = row.date.split('-')
                      return (
                        <tr key={row.date} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-5 py-2.5 font-medium text-gray-700 tabular-nums">
                            {d}/{m}/{y}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{row.total}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-blue-600">{row.answered}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{row.pct_answered}%</td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-gray-500">{fmtHours(row.total_seconds)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Top prospectos */}
          {data.top_prospects.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Mejor vínculo — Prospectos más enganchados</h2>
                <p className="text-xs text-gray-400 mt-0.5">Más llamadas contestadas y mayor duración promedio</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                  <tr>
                    <th className="text-left px-5 py-3">Colegio</th>
                    <th className="text-left px-3 py-3">Comuna</th>
                    <th className="text-center px-3 py-3">Llamadas</th>
                    <th className="text-center px-3 py-3">Contest.</th>
                    <th className="text-center px-3 py-3">Duración prom.</th>
                    <th className="text-left px-3 py-3">Grabación</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_prospects.map(p => (
                    <tr key={p.prospect_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/prospectos/${p.prospect_id}`}
                          className="font-medium text-gray-900 hover:text-green-700 hover:underline text-xs">
                          {p.prospect_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{p.commune}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-xs">{p.total_calls}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-xs font-semibold text-blue-600">{p.answered}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-xs text-gray-500">{fmtDur(p.avg_duration)}</td>
                      <td className="px-3 py-3">
                        {p.best_recording ? (
                          <audio controls className="h-7 w-36"
                            src={`/api/twilio/recording-proxy?url=${encodeURIComponent(p.best_recording)}`}>
                            <track kind="captions" />
                          </audio>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-300">
                            <Play className="w-3 h-3" /> Sin grab.
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!s?.total && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No hay llamadas para el período y filtros seleccionados
            </div>
          )}
        </>
      )}
    </div>
  )
}
