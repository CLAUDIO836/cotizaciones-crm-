'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, Users, Mail, MapPin, CheckCircle2, Circle, Plus, Trash2, Clock } from 'lucide-react'

export interface Activity {
  id: string
  type: string
  subject: string
  note?: string
  due_date?: string
  done: boolean
  done_at?: string
  user_name?: string
  quotation_number?: string
  client_name?: string
}

interface Props {
  quotationId: string
  initialActivities: Activity[]
  userId: string
}

export const TYPE_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  llamada:  { label: 'Llamada',  icon: Phone,  color: '#0ea5e9' },
  reunion:  { label: 'Reunión',  icon: Users,  color: '#8b5cf6' },
  email:    { label: 'Email',    icon: Mail,   color: '#F2B705' },
  visita:   { label: 'Visita',   icon: MapPin, color: '#1B8A4B' },
  tarea:    { label: 'Tarea',    icon: CheckCircle2, color: '#f97316' },
}

export default function ActivitiesPanel({ quotationId, initialActivities, userId }: Props) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ type: 'llamada', subject: '', note: '', due_date: '' })
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('quotation_activities')
      .insert({
        quotation_id: quotationId,
        user_id: userId,
        type: form.type,
        subject: form.subject.trim(),
        note: form.note.trim() || null,
        due_date: form.due_date || null,
      })
      .select('*')
      .single()
    if (!error && data) {
      setActivities(prev => [data, ...prev])
      setForm({ type: 'llamada', subject: '', note: '', due_date: '' })
      setShowForm(false)
    }
    setLoading(false)
  }

  async function toggleDone(act: Activity) {
    const done = !act.done
    const { error } = await supabase
      .from('quotation_activities')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', act.id)
    if (!error) setActivities(prev => prev.map(a => a.id === act.id ? { ...a, done, done_at: done ? new Date().toISOString() : undefined } : a))
  }

  async function deleteActivity(id: string) {
    const { error } = await supabase.from('quotation_activities').delete().eq('id', id)
    if (!error) setActivities(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Gestiones</h3>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#1B8A4B' }}>
          <Plus className="w-3.5 h-3.5" /> Nueva gestión
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                  style={form.type === key
                    ? { background: cfg.color, color: 'white', borderColor: cfg.color }
                    : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }>
                  <Icon className="w-3.5 h-3.5" />{cfg.label}
                </button>
              )
            })}
          </div>
          <input type="text" placeholder="Asunto *" value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" required />
          <input type="datetime-local" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
          <textarea placeholder="Nota (opcional)" value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: '#1B8A4B' }}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {activities.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 text-center py-6">No hay gestiones registradas</p>
        )}
        {activities.map(act => {
          const cfg = TYPE_CONFIG[act.type] ?? TYPE_CONFIG.llamada
          const Icon = cfg.icon
          const isOverdue = act.due_date && !act.done && new Date(act.due_date) < new Date()
          return (
            <div key={act.id} className="flex items-start gap-3 bg-white rounded-xl border p-4 group"
              style={{ opacity: act.done ? 0.6 : 1 }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${cfg.color}18` }}>
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-gray-900 ${act.done ? 'line-through text-gray-400' : ''}`}>
                  {act.subject}
                </p>
                {act.note && <p className="text-xs text-gray-500 mt-0.5">{act.note}</p>}
                {act.due_date && (
                  <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: isOverdue ? '#D33A2C' : '#9ca3af' }}>
                    <Clock className="w-3 h-3" />
                    {new Date(act.due_date).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {isOverdue && ' · Vencida'}
                  </div>
                )}
                {act.user_name && <p className="text-xs text-gray-400 mt-0.5">{act.user_name}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => toggleDone(act)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {act.done
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: '#1B8A4B' }} />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />}
                </button>
                <button onClick={() => deleteActivity(act.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
