'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, Users, Mail, MapPin, CheckCircle2, Circle, Plus, Trash2, Clock } from 'lucide-react'

interface Activity {
  id: string
  type: string
  title: string
  description?: string
  scheduled_at?: string
  completed: boolean
  completed_at?: string
  user_name?: string
}

interface Props {
  quotationId: string
  initialActivities: Activity[]
  userId: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  llamada:  { label: 'Llamada',  icon: Phone,  color: '#0ea5e9' },
  reunion:  { label: 'Reunión',  icon: Users,  color: '#8b5cf6' },
  email:    { label: 'Email',    icon: Mail,   color: '#F2B705' },
  visita:   { label: 'Visita',   icon: MapPin, color: '#1B8A4B' },
}

export default function ActivitiesPanel({ quotationId, initialActivities, userId }: Props) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'llamada',
    title: '',
    description: '',
    scheduled_at: '',
  })
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('activities')
      .insert({
        quotation_id: quotationId,
        user_id: userId,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduled_at: form.scheduled_at || null,
      })
      .select('*')
      .single()
    if (!error && data) {
      setActivities(prev => [data, ...prev])
      setForm({ type: 'llamada', title: '', description: '', scheduled_at: '' })
      setShowForm(false)
    }
    setLoading(false)
  }

  async function toggleComplete(act: Activity) {
    const completed = !act.completed
    const { error } = await supabase
      .from('activities')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', act.id)
    if (!error) {
      setActivities(prev => prev.map(a => a.id === act.id ? { ...a, completed, completed_at: completed ? new Date().toISOString() : undefined } : a))
    }
  }

  async function deleteActivity(id: string) {
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (!error) setActivities(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Gestiones</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
          style={{ background: '#1B8A4B' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva gestión
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border">
          <div className="flex gap-2">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                  style={form.type === key
                    ? { background: cfg.color, color: 'white', borderColor: cfg.color }
                    : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          <input
            type="text"
            placeholder="Título de la gestión"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
            required
          />
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
          />
          <textarea
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: '#1B8A4B' }}
            >
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
          return (
            <div
              key={act.id}
              className="flex items-start gap-3 bg-white rounded-xl border p-4 group"
              style={{ opacity: act.completed ? 0.65 : 1 }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${cfg.color}18` }}
              >
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-gray-900 ${act.completed ? 'line-through text-gray-400' : ''}`}>
                  {act.title}
                </p>
                {act.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>
                )}
                {act.scheduled_at && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(act.scheduled_at).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggleComplete(act)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title={act.completed ? 'Marcar pendiente' : 'Marcar completada'}
                >
                  {act.completed
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: '#1B8A4B' }} />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />
                  }
                </button>
                <button
                  onClick={() => deleteActivity(act.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                >
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
