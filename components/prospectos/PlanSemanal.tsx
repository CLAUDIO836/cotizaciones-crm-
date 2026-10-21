'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Phone, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

const CALLS_PER_DAY = 36   // 10:00–13:00 / 5 min
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

type CommuneData = { commune: string; pending: number }
type Executive = { user_id: string; user_name: string; communes: CommuneData[] }
type DayPlan = { communes: CommuneData[]; total: number }
type ExecPlan = Executive & { days: DayPlan[] }

function buildPlan(executives: Executive[]): ExecPlan[] {
  return executives.map(exec => {
    const days: DayPlan[] = DAYS.map(() => ({ communes: [], total: 0 }))
    // Sort by pending desc so big communes spread across days
    const sorted = [...exec.communes].sort((a, b) => b.pending - a.pending)

    for (const com of sorted) {
      // Assign to the least-loaded day that still has capacity, else last day
      let target = days.reduce((best, d, i) =>
        d.total < days[best].total ? i : best, 0)
      days[target].communes.push(com)
      days[target].total += com.pending
    }
    return { ...exec, days }
  })
}

function timeSlots(total: number): string {
  const start = 10 * 60  // 10:00 in minutes
  const end   = Math.min(start + total * 5, 13 * 60)
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`
  return `${fmt(start)} – ${fmt(end)}`
}

export default function PlanSemanal({
  campaignId,
  campaignName,
}: {
  campaignId: string
  campaignName: string
}) {
  const [plan, setPlan]       = useState<ExecPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/prospectos/call-plan?campaign_id=${campaignId}`)
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setPlan(buildPlan(d.data ?? []))
    } catch {
      setError('No se pudo cargar el plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [campaignId])

  // Total for selected day across all executives
  const dayTotal = plan.reduce((s, e) => s + e.days[activeDay].total, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/prospectos/${campaignId}`} className="text-sm text-gray-400 hover:text-gray-600">
              ← {campaignName}
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Plan Semanal de Llamadas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">10:00 – 13:00 · 5 min/llamada · 36 llamadas/día por ejecutivo</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {!loading && plan.length === 0 && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center text-gray-500">
          <p className="font-semibold">Sin asignaciones de comunas</p>
          <p className="text-sm mt-1">Asigna comunas a ejecutivos en la vista de Administración.</p>
        </div>
      )}

      {plan.length > 0 && (
        <>
          {/* Day tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
            {DAYS.map((day, i) => {
              const total = plan.reduce((s, e) => s + e.days[i].total, 0)
              return (
                <button key={day} onClick={() => setActiveDay(i)}
                  className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-sm font-semibold transition-all ${
                    activeDay === i
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <span>{day}</span>
                  <span className={`text-xs font-normal mt-0.5 ${activeDay === i ? 'text-green-600' : 'text-gray-400'}`}>
                    {total} prosp.
                  </span>
                </button>
              )
            })}
          </div>

          {/* Day summary banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <Phone className="w-4 h-4 text-green-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-green-800">{DAYS[activeDay]}</span>
              <span className="text-sm text-green-700 ml-2">— {dayTotal} llamadas en total · {timeSlots(Math.min(dayTotal, CALLS_PER_DAY * plan.length))}</span>
            </div>
          </div>

          {/* Executives for this day */}
          <div className="flex flex-col gap-3">
            {plan.map(exec => {
              const day = exec.days[activeDay]
              const key = `${exec.user_id}-${activeDay}`
              const open = expanded[key] ?? true
              return (
                <div key={exec.user_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Executive header */}
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !open }))}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">
                        {exec.user_name?.[0] ?? '?'}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 text-sm">{exec.user_name ?? 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500">
                          {day.communes.length} {day.communes.length === 1 ? 'comuna' : 'comunas'} · {day.total} prospectos · {timeSlots(day.total)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                        day.total > CALLS_PER_DAY
                          ? 'bg-red-100 text-red-700'
                          : day.total > CALLS_PER_DAY * 0.8
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {day.total}/{CALLS_PER_DAY}
                      </span>
                      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Communes list */}
                  {open && day.communes.length > 0 && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {day.communes.map((c, ci) => {
                        const slotStart = 10 * 60 + day.communes.slice(0, ci).reduce((s, x) => s + x.pending * 5, 0)
                        const slotEnd   = slotStart + c.pending * 5
                        const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`
                        return (
                          <div key={c.commune} className="flex items-center gap-4 px-5 py-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/prospectos/${campaignId}?commune=${encodeURIComponent(c.commune)}`}
                                className="font-semibold text-sm text-gray-800 hover:text-green-700 hover:underline">
                                {c.commune}
                              </Link>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {fmt(Math.min(slotStart, 12 * 60 + 55))} – {fmt(Math.min(slotEnd, 13 * 60))}
                            </span>
                            <span className="text-xs font-semibold text-gray-600 w-14 text-right shrink-0">
                              {c.pending} llamadas
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {open && day.communes.length === 0 && (
                    <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400 text-center">
                      Sin comunas asignadas para este día
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Week overview table */}
          <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">
              Resumen semanal
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-36">Ejecutivo</th>
                    {DAYS.map(d => (
                      <th key={d} className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">{d}</th>
                    ))}
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {plan.map(exec => (
                    <tr key={exec.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 text-xs">{exec.user_name}</td>
                      {exec.days.map((day, i) => (
                        <td key={i} className="px-3 py-3 text-center">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            day.total === 0
                              ? 'text-gray-300'
                              : day.total > CALLS_PER_DAY
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-50 text-green-700'
                          }`}>
                            {day.total || '—'}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center text-xs font-bold text-gray-700">
                        {exec.communes.reduce((s, c) => s + c.pending, 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2.5 text-xs text-gray-500">Total día</td>
                    {DAYS.map((_, i) => (
                      <td key={i} className="px-3 py-2.5 text-center text-xs text-gray-700">
                        {plan.reduce((s, e) => s + e.days[i].total, 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center text-xs text-gray-700">
                      {plan.reduce((s, e) => s + e.communes.reduce((s2, c) => s2 + c.pending, 0), 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
