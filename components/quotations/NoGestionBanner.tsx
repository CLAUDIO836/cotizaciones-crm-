'use client'

import { useState } from 'react'
import { AlertCircle, Phone, Users, Mail, MapPin, CheckCircle2, X } from 'lucide-react'

interface Props {
  quotationId: string
  userId:      string
  onCreated:   () => void
}

const QUICK_TYPES = [
  { key: 'llamada', label: 'Programar llamada', Icon: Phone,  color: '#0ea5e9' },
  { key: 'reunion', label: 'Agendar reunión',   Icon: Users,  color: '#8b5cf6' },
  { key: 'email',   label: 'Enviar correo',     Icon: Mail,   color: '#F2B705' },
  { key: 'visita',  label: 'Programar visita',  Icon: MapPin, color: '#1B8A4B' },
  { key: 'tarea',   label: 'Crear tarea',       Icon: CheckCircle2, color: '#f97316' },
]

export default function NoGestionBanner({ quotationId, userId, onCreated }: Props) {
  const [dismissed, setDismissed]   = useState(false)
  const [creating, setCreating]     = useState<string | null>(null)
  const [form, setForm]             = useState({ subject: '', due_date: '', note: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  if (dismissed) return null

  async function handleSave() {
    if (!form.subject.trim()) { setError('Asunto requerido'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation_id: quotationId,
          user_id:      userId,
          type:         creating,
          subject:      form.subject.trim(),
          note:         form.note.trim() || null,
          due_date:     form.due_date || null,
        }),
      })
      if (res.ok) {
        onCreated()
        setDismissed(true)
      } else {
        setError('No se pudo guardar. Inténtalo de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Este negocio no tiene gestiones</p>
            <p className="text-xs text-amber-600 mt-0.5">Programa una actividad para darle seguimiento antes de que se enfríe.</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!creating ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {QUICK_TYPES.map(({ key, label, Icon, color }) => (
            <button key={key} onClick={() => { setCreating(key); setForm({ subject: '', due_date: '', note: '' }) }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-white hover:shadow-sm transition-all"
              style={{ color, borderColor: `${color}40` }}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700 capitalize">
              {QUICK_TYPES.find(t => t.key === creating)?.label}
            </span>
            <button onClick={() => setCreating(null)} className="text-xs text-amber-500 hover:underline">cambiar</button>
          </div>
          <input type="text" placeholder="Asunto *" value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200" />
          <input type="datetime-local" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200" />
          <textarea placeholder="Nota (opcional)" value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCreating(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="text-xs font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#F2A805' }}>
              {saving ? 'Guardando...' : 'Guardar gestión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
