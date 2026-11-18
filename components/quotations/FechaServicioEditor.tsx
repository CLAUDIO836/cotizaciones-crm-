'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
  quotationId: string
  fechaSalida: string   // YYYY-MM-DD
  status:      string
  daysLeft:    number
  overdue:     boolean
  nearClose:   boolean
}

export default function FechaServicioEditor({ quotationId, fechaSalida, status, daysLeft, overdue, nearClose }: Props) {
  const router  = useRouter()
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(fechaSalida)
  const [saving,  setSaving]  = useState(false)

  const textClass = overdue
    ? 'text-amber-600'
    : nearClose
    ? 'text-orange-500'
    : status === 'won'
    ? 'text-green-600'
    : status === 'lost'
    ? 'text-red-500'
    : 'text-gray-900'

  async function save() {
    if (!value || value === fechaSalida) { setEditing(false); return }
    setSaving(true)
    await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'update', id: quotationId, fecha_salida: value }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          className="text-sm border rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-green-200 w-32"
        />
        <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => { setEditing(false); setValue(fechaSalida) }} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group">
      <p className={`text-sm font-semibold ${textClass}`}>
        {status === 'won' ? '✅ ' : status === 'lost' ? '❌ ' : '📅 '}
        {formatDate(fechaSalida)}
      </p>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 ml-1"
        title="Editar fecha"
      >
        <Pencil className="w-3 h-3" />
      </button>
      {status === 'open' && (
        <span className={`text-xs ml-1 ${overdue ? 'text-amber-500' : nearClose ? 'text-orange-400' : 'text-gray-400'}`}>
          {overdue
            ? `hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? 's' : ''}`
            : daysLeft === 0
            ? 'hoy'
            : daysLeft === 1
            ? 'mañana'
            : `en ${daysLeft} días`}
        </span>
      )}
    </div>
  )
}
