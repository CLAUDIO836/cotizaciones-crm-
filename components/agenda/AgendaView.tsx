'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Activity, TYPE_CONFIG } from '@/components/quotations/ActivitiesPanel'
import { CheckCircle2, Circle, Clock, Building2, FileText } from 'lucide-react'
import Link from 'next/link'

interface Seller { id: string; name: string }

interface Props {
  activities: Activity[]
  sellers: Seller[]
  currentFilter: string
  currentTipo?: string
  currentVendedor?: string
  isAdmin: boolean
  userId: string
}

const FILTERS = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'hoy',       label: 'Hoy' },
  { key: 'vencidas',  label: 'Vencidas' },
  { key: 'todas',     label: 'Todas' },
]

export default function AgendaView({ activities: initial, sellers, currentFilter, currentTipo, currentVendedor, isAdmin, userId }: Props) {
  const [activities, setActivities] = useState(initial)
  const router = useRouter()
  const supabase = createClient()

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const merged = { filter: currentFilter, tipo: currentTipo, vendedor: currentVendedor, ...params }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`/agenda?${sp.toString()}`)
  }

  async function toggleDone(act: Activity) {
    const done = !act.done
    const { error } = await supabase
      .from('quotation_activities')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', act.id)
    if (!error) setActivities(prev => prev.map(a => a.id === act.id ? { ...a, done } : a))
  }

  const pendingCount = activities.filter(a => !a.done).length
  const overdueCount = activities.filter(a => !a.done && a.due_date && new Date(a.due_date) < new Date()).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{activities.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: '#1B8A4B' }}>{pendingCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pendientes</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: '#D33A2C' }}>{overdueCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Vencidas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => navigate({ filter: f.key })}
              className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
              style={currentFilter === f.key
                ? { background: 'white', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                : { color: '#6b7280' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Tipo filter */}
        <div className="flex gap-1">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <button key={key} onClick={() => navigate({ tipo: currentTipo === key ? undefined : key })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all"
                style={currentTipo === key
                  ? { background: cfg.color, color: 'white', borderColor: cfg.color }
                  : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
                <Icon className="w-3.5 h-3.5" />{cfg.label}
              </button>
            )
          })}
        </div>

        {/* Vendedor filter (admin only) */}
        {isAdmin && sellers.length > 0 && (
          <select value={currentVendedor ?? ''} onChange={e => navigate({ vendedor: e.target.value || undefined })}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white text-gray-700">
            <option value="">Todos los vendedores</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {activities.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No hay actividades para este filtro</p>
          </div>
        )}
        {activities.map(act => {
          const cfg = TYPE_CONFIG[act.type] ?? TYPE_CONFIG.llamada
          const Icon = cfg.icon
          const isOverdue = act.due_date && !act.done && new Date(act.due_date) < new Date()
          return (
            <div key={act.id} className="flex items-start gap-3 bg-white rounded-xl border p-4 group hover:border-gray-300 transition-colors"
              style={{ opacity: act.done ? 0.6 : 1 }}>
              <button onClick={() => toggleDone(act)} className="mt-0.5 flex-shrink-0">
                {act.done
                  ? <CheckCircle2 className="w-5 h-5" style={{ color: '#1B8A4B' }} />
                  : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />}
              </button>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${cfg.color}18` }}>
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-gray-900 ${act.done ? 'line-through text-gray-400' : ''}`}>
                  {act.subject}
                </p>
                {act.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{act.note}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  {act.quotation_number && (
                    <Link href={`/cotizaciones/${(act as any).quotation_id}?tab=gestiones`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <FileText className="w-3 h-3" />
                      {act.quotation_number}
                    </Link>
                  )}
                  {act.client_name && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Building2 className="w-3 h-3" />
                      {act.client_name}
                    </span>
                  )}
                  {act.due_date && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#D33A2C' : '#9ca3af' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(act.due_date).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {isOverdue && ' · Vencida'}
                    </span>
                  )}
                  {act.user_name && <span className="text-xs text-gray-400">{act.user_name}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
