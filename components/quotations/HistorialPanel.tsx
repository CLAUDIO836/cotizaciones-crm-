'use client'

import { useState, useEffect, useCallback } from 'react'

interface HistorialRow {
  id: string
  event_at: string
  tipo: 'edit' | 'email_out' | 'email_in' | 'status' | 'firma'
  usuario: string
  descripcion: string
}

function utcToChile(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TIPO_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  edit:      { label: 'Edición',         bg: '#eff6ff', color: '#1d4ed8', icon: '✏️' },
  email_out: { label: 'Correo enviado',  bg: '#f0fdf4', color: '#166534', icon: '📧' },
  email_in:  { label: 'Correo recibido', bg: '#fefce8', color: '#854d0e', icon: '📩' },
  status:    { label: 'Estado',          bg: '#faf5ff', color: '#6d28d9', icon: '🔄' },
  firma:     { label: 'Firma',           bg: '#f0fdf4', color: '#166534', icon: '✅' },
}

export default function HistorialPanel({ quotationId }: { quotationId: string }) {
  const [rows, setRows] = useState<HistorialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/quotations/${quotationId}/historial`)
      const d = await r.json()
      setRows(d.data ?? [])
    } catch {
      setError('Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }, [quotationId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
  )

  if (!rows.length) return (
    <div className="p-8 text-center text-gray-400 text-sm">Sin registros de historial aún.</div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
          {rows.length} registro{rows.length !== 1 ? 's' : ''}
        </p>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 underline">
          Actualizar
        </button>
      </div>

      {rows.map(row => {
        const cfg = TIPO_CONFIG[row.tipo] ?? { label: row.tipo, bg: '#f9fafb', color: '#374151', icon: '•' }
        return (
          <div key={row.id} className="flex gap-3 items-start rounded-xl border p-3"
            style={{ background: cfg.bg, borderColor: cfg.color + '33' }}>
            <span className="text-lg leading-none mt-0.5">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: cfg.color + '22', color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="text-xs text-gray-500">{utcToChile(row.event_at)}</span>
                <span className="text-xs text-gray-400">— {row.usuario}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{row.descripcion}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
