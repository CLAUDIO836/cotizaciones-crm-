'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  TrendingUp, ArrowLeft, Target, Pencil, Check, X,
  ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react'
import { Campaign } from '@/lib/prospectos-types'
import { UserSession } from '@/lib/api'

const STORAGE_KEY = 'crm_daily_coverage_goal'
const DEFAULT_GOAL = 40

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  con_intencion: number
  contactada: number
  fria: number
  sin_respuesta: number
  total_colegios: number
  total_calls: number
  total_campaign: number
  coverage_pct: number
  intencion_pct: number
}

interface ExecRow {
  user_id: string
  executive_name: string
  con_intencion: number
  contactada: number
  fria: number
  sin_respuesta: number
  total_colegios: number
  total_calls: number
  days_active: number
  daily_avg_intencion: number
  daily_avg_total: number
  intencion_rate: number
}

interface CommuneProspect {
  prospect_id: string
  prospect_name: string
  best_duration: number
  call_count: number
  category: string
  best_recording: string | null
  last_calls: string[]
}

interface CommuneRow {
  commune: string
  total: number
  llamados: number
  con_intencion: number
  contactada: number
  fria: number
  sin_respuesta: number
  sin_contacto: number
  coverage_pct: number
  intencion_pct: number
  prospects: CommuneProspect[]
}

interface TopProspect {
  prospect_id: string
  prospect_name: string
  commune: string
  status: string
  best_duration: number
  call_count: number
  category: string
  best_recording: string | null
}

interface DashboardData {
  summary: Summary
  executive_stats: ExecRow[]
  commune_stats: CommuneRow[]
  top_prospects: TopProspect[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

const CAT_LABEL: Record<string, string> = {
  con_intencion: 'Con intención (+90s)',
  contactada:    'Contactada (46–89s)',
  fria:          'Fría (31–45s)',
  sin_respuesta: 'Sin respuesta (0–30s)',
}
const CAT_COLOR: Record<string, string> = {
  con_intencion: 'bg-green-100 text-green-700',
  contactada:    'bg-blue-100 text-blue-700',
  fria:          'bg-orange-100 text-orange-700',
  sin_respuesta: 'bg-gray-100 text-gray-600',
}
const CAT_DOT: Record<string, string> = {
  con_intencion: 'bg-green-500',
  contactada:    'bg-blue-400',
  fria:          'bg-orange-400',
  sin_respuesta: 'bg-gray-300',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function todayStr() { return new Date().toISOString().slice(0, 10) }

function monthRange(year: number, month: number) {
  const m   = String(month).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(last).padStart(2, '0')}` }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BigCard({ value, label, sub, dot }: {
  value: number | string; label: string; sub?: string; dot: string
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
      <div className={`w-3 h-10 rounded-full flex-shrink-0 ${dot}`} />
      <div>
        <div className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{value}</div>
        <div className="text-sm font-semibold text-gray-700 mt-1">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function GoalBar({ exec, goal }: { exec: ExecRow; goal: number }) {
  const realContact  = exec.con_intencion + exec.contactada
  const dailyAvgReal = exec.days_active > 0 ? realContact / exec.days_active : realContact
  const pct          = Math.min(100, Math.round((dailyAvgReal / goal) * 100))
  const color        = pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626'
  const intentionPct = exec.total_colegios > 0
    ? Math.round(exec.con_intencion / exec.total_colegios * 100) : 0
  const intentionColor = intentionPct >= 30 ? '#16a34a' : intentionPct >= 15 ? '#d97706' : '#6b7280'
  const realPct = exec.total_colegios > 0
    ? Math.round(realContact / exec.total_colegios * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-semibold text-gray-800">{exec.executive_name}</span>
        <div className="text-xs text-gray-500 tabular-nums text-right flex items-center gap-2">
          <span className="text-gray-400">{exec.total_calls ?? exec.total_colegios} intentos</span>
          <span className="text-gray-300">·</span>
          <span className="font-bold" style={{ color }}>{dailyAvgReal.toFixed(1)}</span>
          <span className="text-gray-400">/ {goal} real/día</span>
          <span className="text-gray-300">·</span>
          <span className="font-bold" style={{ color: intentionColor }}>{intentionPct}% intención</span>
        </div>
      </div>
      {/* Barra principal: contacto real (≥46s) vs meta */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      {/* Barra de intención */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-500 bg-green-500"
          style={{ width: `${Math.min(100, intentionPct)}%` }} />
      </div>
      <div className="flex gap-4 mt-1.5 text-xs text-gray-400 tabular-nums">
        <span><span className="font-medium text-gray-500">{exec.total_calls ?? exec.total_colegios}</span> intentos</span>
        <span><span className="font-medium text-gray-700">{exec.total_colegios}</span> marcados</span>
        <span><span className="font-medium text-blue-600">{realContact}</span> contacto real
          <span className="text-gray-300 ml-1">({realPct}%)</span>
        </span>
        <span><span className="font-medium text-green-600">{exec.con_intencion}</span> con intención</span>
        <span><span className="font-medium text-gray-300">{exec.sin_respuesta}</span> sin resp.</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProspectosDashboard({
  campaign, isAdmin, executives,
}: {
  campaign: Campaign
  user: UserSession
  isAdmin: boolean
  executives: { id: string; name: string }[]
}) {
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
  const [showComm,      setShowComm]      = useState(true)
  const [showTop,       setShowTop]       = useState(true)
  const [expandedComm,  setExpandedComm]  = useState<string | null>(null)

  // Meta editable
  const [goal,      setGoal]      = useState(DEFAULT_GOAL)
  const [editGoal,  setEditGoal]  = useState(false)
  const [goalInput, setGoalInput] = useState(String(DEFAULT_GOAL))
  const goalRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v) { setGoal(parseInt(v)); setGoalInput(v) }
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
    if (m) { const r = monthRange(yi, parseInt(m)); setDateFrom(r.from); setDateTo(r.to) }
    else   { setDateFrom(`${yi}-01-01`); setDateTo(`${yi}-12-31`) }
  }

  const fetchData = useCallback(async (df = dateFrom, dt = dateTo, fu = filterUser, fc = filterComm) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ campaign_id: campaign.id })
      if (df) qs.set('date_from', df)
      if (dt) qs.set('date_to', dt)
      if (fu) qs.set('user_id', fu)
      if (fc) qs.set('commune', fc)
      const res  = await fetch(`/api/prospectos/${campaign.id}/dashboard?${qs}`)
      const json = await res.json()
      setData(json.data ?? null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  // Carga inicial automática
  useEffect(() => { fetchData(dateFrom, dateTo, filterUser, filterComm) }, []) // eslint-disable-line

  function buscar() { fetchData(dateFrom, dateTo, filterUser, filterComm) }

  const s = data?.summary

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/prospectos/${campaign.id}`}
            className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
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
          <Target className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-sm text-gray-600">Meta:</span>
          {editGoal ? (
            <>
              <input ref={goalRef} type="number" value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditGoal(false) }}
                className="w-14 text-sm font-bold text-center border-b-2 border-green-500 outline-none bg-transparent" autoFocus />
              <span className="text-xs text-gray-400">colegios/día</span>
              <button onClick={saveGoal} className="text-green-600"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditGoal(false)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-gray-900">{goal} colegios/día</span>
              <span className="text-xs text-gray-400">contacto real</span>
              <button onClick={() => { setEditGoal(true); setGoalInput(String(goal)) }} className="text-gray-400 hover:text-gray-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => { const t = todayStr(); setDateFrom(t); setDateTo(t); setQuickYear(''); setQuickMonth(''); fetchData(t, t, filterUser, filterComm) }}
          className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
            dateFrom === todayStr() && dateTo === todayStr()
              ? 'bg-green-600 text-white border-green-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>Hoy</button>
        <select value={quickYear} onChange={e => applyQuick(e.target.value, quickMonth)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
          <option value="">Año</option>
          {[year, year-1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={quickMonth} onChange={e => applyQuick(quickYear, e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
          <option value="">{quickYear ? 'Todo el año' : 'Mes'}</option>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
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
          {(data?.commune_stats ?? []).filter(c => c.llamados > 0).map(c => (
            <option key={c.commune} value={c.commune}>{c.commune}</option>
          ))}
        </select>
        <button onClick={buscar}
          className="px-4 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Buscar
        </button>
        {(filterUser || filterComm) && (
          <button onClick={() => { setFilterUser(''); setFilterComm('') }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
          Cargando...
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Tres capas — resumen rápido ── */}
          {s && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-2.5 h-8 rounded-full bg-blue-400 flex-shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-blue-700 tabular-nums leading-none">{s.total_calls ?? s.total_colegios}</div>
                  <div className="text-xs font-semibold text-blue-600 mt-0.5">Intentos de marcado</div>
                  <div className="text-xs text-blue-400">Incluye rellamadas al mismo colegio</div>
                </div>
              </div>
              {(() => {
                const metaPct = Math.min(100, Math.round(s.total_colegios / goal * 100))
                const metaColor = metaPct >= 100 ? '#16a34a' : metaPct >= 70 ? '#d97706' : '#dc2626'
                return (
                  <div className="border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: '#f9fafb' }}>
                    <div className="w-2.5 h-8 rounded-full flex-shrink-0" style={{ background: metaColor }} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: metaColor }}>{s.total_colegios}</span>
                        <span className="text-sm text-gray-400 font-medium">/ {goal}</span>
                        <span className="ml-auto text-lg font-bold tabular-nums" style={{ color: metaColor }}>{metaPct}%</span>
                      </div>
                      <div className="text-xs font-semibold text-gray-700 mt-1">Colegios marcados · Meta diaria</div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${metaPct}%`, background: metaColor }} />
                      </div>
                    </div>
                  </div>
                )
              })()}
              {(() => {
                const realContact = s.con_intencion + s.contactada
                const realPct = s.total_colegios > 0
                  ? Math.round(realContact / s.total_colegios * 100) : 0
                const realColor = realPct >= 50 ? 'green' : realPct >= 25 ? 'yellow' : 'red'
                const colorMap: Record<string, { bg: string; border: string; dot: string; title: string; sub: string }> = {
                  green:  { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  title: 'text-green-700', sub: 'text-green-500' },
                  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', title: 'text-yellow-700', sub: 'text-yellow-500' },
                  red:    { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-400',    title: 'text-red-700',   sub: 'text-red-400' },
                }
                const c = colorMap[realColor]
                return (
                  <div className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
                    <div className={`w-2.5 h-8 rounded-full flex-shrink-0 ${c.dot}`} />
                    <div>
                      <div className={`text-2xl font-bold tabular-nums leading-none ${c.title}`}>
                        {realPct}%
                      </div>
                      <div className={`text-xs font-semibold mt-0.5 ${c.title}`}>Tasa de intención</div>
                      <div className={`text-xs mt-0.5 ${c.sub}`}>{s.con_intencion} colegios ≥1 min</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigCard value={s?.con_intencion ?? 0}
              label="Con intención"
              sub={`≥1:30 min · ${s?.intencion_pct ?? 0}% del total campaña`}
              dot="bg-green-500" />
            <BigCard value={s?.contactada ?? 0}
              label="Contactada"
              sub="46 – 89 segundos"
              dot="bg-blue-400" />
            <BigCard value={s?.fria ?? 0}
              label="Fría"
              sub="31 – 45 segundos"
              dot="bg-orange-400" />
            <BigCard value={s?.sin_respuesta ?? 0}
              label="Sin respuesta"
              sub="0 – 30 segundos"
              dot="bg-gray-300" />
          </div>

          {/* Cobertura global */}
          {s && (() => {
            const realContact = s.con_intencion + s.contactada
            const realPct = s.total_campaign > 0
              ? Math.min(100, Math.round(realContact / s.total_campaign * 100)) : 0
            return (
              <div className="bg-white rounded-xl border px-5 py-4 space-y-3">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold text-gray-900 tabular-nums">{s.total_colegios}</span>
                    <span className="text-gray-400 text-sm ml-1">/ {s.total_campaign} colegios en campaña</span>
                  </div>
                  <div className="flex gap-3 text-xs flex-wrap">
                    {(['con_intencion','contactada','fria','sin_respuesta'] as const).map(cat => (
                      <span key={cat} className={`px-2 py-1 rounded-full font-medium ${CAT_COLOR[cat]}`}>
                        {s[cat]} {CAT_LABEL[cat].toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Marcados (cualquier duración)</span>
                    <span className="font-semibold">{s.coverage_pct}% · {s.total_colegios} colegios</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-400 transition-all"
                      style={{ width: `${s.coverage_pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="text-blue-600 font-medium">Contacto real (≥46s, alguien contestó)</span>
                    <span className="font-semibold text-blue-700">{realPct}% · {realContact} colegios</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${realPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Meta por ejecutivo ── */}
          {data.executive_stats.length > 0 && (
            <div className="bg-white rounded-xl border p-5 space-y-5">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
                Progreso meta — contacto real por ejecutivo
              </h2>
              {data.executive_stats.map(exec => (
                <GoalBar key={exec.user_id} exec={exec} goal={goal} />
              ))}
            </div>
          )}

          {/* ── Tabla ejecutivos (admin) ── */}
          {isAdmin && data.executive_stats.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Detalle por ejecutivo</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                  <tr>
                    <th className="text-left px-5 py-3">Ejecutivo</th>
                    <th className="text-center px-3 py-3 text-gray-400">Intentos</th>
                    <th className="text-center px-3 py-3">Marcados</th>
                    <th className="text-center px-3 py-3 text-blue-700 font-semibold">Contacto real</th>
                    <th className="text-center px-3 py-3 text-green-600">Intención</th>
                    <th className="text-center px-3 py-3 text-gray-400">Sin resp.</th>
                    <th className="text-center px-3 py-3">Días</th>
                    <th className="text-center px-3 py-3">Real/día</th>
                    <th className="text-center px-3 py-3">Tasa int.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.executive_stats.map(exec => {
                    const realContact = exec.con_intencion + exec.contactada
                    const dailyAvgReal = exec.days_active > 0 ? realContact / exec.days_active : realContact
                    const onGoal = dailyAvgReal >= goal
                    const intentionPct = exec.total_colegios > 0
                      ? Math.round(exec.con_intencion / exec.total_colegios * 100) : 0
                    return (
                      <tr key={exec.user_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{exec.executive_name}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-400">{exec.total_calls ?? exec.total_colegios}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-600">{exec.total_colegios}</td>
                        <td className="px-3 py-3 text-center tabular-nums font-bold text-blue-700">{realContact}</td>
                        <td className="px-3 py-3 text-center tabular-nums font-bold text-green-600">{exec.con_intencion}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-400">{exec.sin_respuesta}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-500">{exec.days_active}</td>
                        <td className={`px-3 py-3 text-center tabular-nums font-bold ${onGoal ? 'text-green-600' : 'text-red-500'}`}>
                          {dailyAvgReal.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-sm font-semibold" style={{
                          color: intentionPct >= 30 ? '#16a34a' : intentionPct >= 15 ? '#d97706' : '#6b7280'
                        }}>
                          {intentionPct}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Comunas ── */}
          {data.commune_stats.length > 0 && (() => {
            const visibleCommunes = filterUser
              ? data.commune_stats.filter(c => c.llamados > 0)
              : data.commune_stats
            return (
            <div className="bg-white rounded-xl border overflow-hidden">
              <button className="w-full px-5 py-4 flex items-center justify-between"
                onClick={() => setShowComm(v => !v)}>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-800">Rendimiento por comuna</h2>
                  {filterUser && <span className="text-xs text-blue-500 font-normal">({visibleCommunes.length} comunas con actividad)</span>}
                </div>
                {showComm ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showComm && (
                <table className="w-full text-sm border-t">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                    <tr>
                      <th className="text-left px-5 py-3">Comuna</th>
                      <th className="text-center px-3 py-3">Total</th>
                      <th className="text-center px-3 py-3">Marcados</th>
                      <th className="text-center px-3 py-3 text-red-400">Sin llamar</th>
                      <th className="text-center px-3 py-3 text-green-600">Intención</th>
                      <th className="text-center px-3 py-3 text-blue-600">Contactada</th>
                      <th className="text-center px-3 py-3 text-orange-500">Fría</th>
                      <th className="text-center px-3 py-3 text-gray-400">Sin resp.</th>
                      <th className="text-center px-3 py-3 text-blue-700 font-semibold">Contacto real</th>
                      <th className="text-center px-3 py-3">Cobertura real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCommunes.map(c => {
                      const realContact = c.con_intencion + c.contactada
                      const realPct = c.total > 0 ? Math.round(realContact / c.total * 100) : 0
                      const isComplete = realPct >= 90
                      const isExpanded = expandedComm === c.commune
                      const dot = isComplete ? 'bg-green-500' : realPct >= 40 ? 'bg-blue-400' : c.llamados > 0 ? 'bg-orange-400' : 'bg-red-300'
                      return (
                        <>
                          <tr key={c.commune}
                            className={`border-b hover:bg-gray-50 cursor-pointer select-none ${isComplete ? 'bg-green-50/40' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                            onClick={() => setExpandedComm(isExpanded ? null : c.commune)}>
                            <td className="px-5 py-2.5 font-medium text-gray-800">
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                                {c.commune}
                                {isComplete && <span className="text-xs text-green-600 font-normal">✓ cubierta</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-gray-500">{c.total}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{c.llamados}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-red-400">{Math.max(0, c.total - c.llamados)}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums font-bold text-green-600">{c.con_intencion}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-blue-600">{c.contactada}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-orange-500">{c.fria}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-gray-400">{c.sin_respuesta}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums font-bold text-blue-700">{realContact}</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${realPct}%`, background: isComplete ? '#16a34a' : '#3b82f6' }} />
                                </div>
                                <span className={`text-xs tabular-nums w-8 font-medium ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>{realPct}%</span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${c.commune}-detail`} className="border-b bg-blue-50/20">
                              <td colSpan={10} className="px-6 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 font-medium border-b border-blue-100">
                                      <th className="text-left pb-1.5">Colegio</th>
                                      <th className="text-center pb-1.5">Categoría</th>
                                      <th className="text-center pb-1.5">Mejor llamada</th>
                                      <th className="text-center pb-1.5"># llamadas</th>
                                      <th className="text-left pb-1.5 pl-3">Últimas 3 llamadas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(c.prospects ?? []).map(p => (
                                      <tr key={p.prospect_id} className="border-b border-blue-50 last:border-0">
                                        <td className="py-1.5">
                                          <Link href={`/prospectos/${p.prospect_id}`}
                                            className="font-medium text-gray-800 hover:text-green-700 hover:underline"
                                            onClick={e => e.stopPropagation()}>
                                            {p.prospect_name}
                                          </Link>
                                        </td>
                                        <td className="py-1.5 text-center">
                                          <span className={`px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[p.category]}`}>
                                            {CAT_LABEL[p.category]}
                                          </span>
                                        </td>
                                        <td className="py-1.5 text-center font-mono font-semibold text-gray-700">{fmtDur(p.best_duration)}</td>
                                        <td className="py-1.5 text-center tabular-nums text-gray-500">{p.call_count}</td>
                                        <td className="py-1.5 pl-3">
                                          <div className="flex gap-1 flex-wrap">
                                            {(p.last_calls ?? []).map((d, i) => (
                                              <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">{d}</span>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            )
          })()}

          {/* ── Top prospectos ── */}
          {data.top_prospects.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <button className="w-full px-5 py-4 flex items-center justify-between"
                onClick={() => setShowTop(v => !v)}>
                <div>
                  <h2 className="font-semibold text-gray-800 text-left">Mejor vínculo — Colegios más enganchados</h2>
                  <p className="text-xs text-gray-400 text-left">Ordenados por duración de mejor llamada (≥15 seg)</p>
                </div>
                {showTop ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showTop && (
                <table className="w-full text-sm border-t">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
                    <tr>
                      <th className="text-left px-5 py-3">Colegio</th>
                      <th className="text-left px-3 py-3">Comuna</th>
                      <th className="text-center px-3 py-3">Categoría</th>
                      <th className="text-center px-3 py-3">Mejor llamada</th>
                      <th className="text-center px-3 py-3"># llamadas</th>
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
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLOR[p.category]}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${CAT_DOT[p.category]}`} />
                            {CAT_LABEL[p.category]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-mono font-semibold text-gray-700">
                          {fmtDur(p.best_duration)}
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular-nums text-gray-500">{p.call_count}</td>
                        <td className="px-3 py-3">
                          {p.best_recording
                            ? <audio controls className="h-7 w-36"
                                src={`/api/twilio/recording-proxy?url=${encodeURIComponent(p.best_recording)}`}>
                                <track kind="captions" />
                              </audio>
                            : <span className="text-xs text-gray-300">Sin grab.</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!s?.total_colegios && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No hay llamadas para el período seleccionado
            </div>
          )}
        </>
      )}
    </div>
  )
}
