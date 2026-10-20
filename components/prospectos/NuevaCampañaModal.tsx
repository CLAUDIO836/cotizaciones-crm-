'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export default function NuevaCampañaModal() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    segment: 'educacional',
    region: 'Región Metropolitana',
    daily_goal: '35',
    description: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/prospectos/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, daily_goal: Number(form.daily_goal) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear campaña')
      setOpen(false)
      setForm({ name: '', segment: 'educacional', region: 'Región Metropolitana', daily_goal: '35', description: '' })
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
        style={{ background: '#1B8A4B' }}>
        + Nueva Campaña
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva Campaña</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Nombre *</label>
                <input
                  required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Colegios RM Oct 2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Segmento</label>
                  <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400">
                    <option value="educacional">Educacional</option>
                    <option value="corporativo">Corporativo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Meta diaria</label>
                  <input type="number" min="1" max="200" value={form.daily_goal}
                    onChange={e => setForm(f => ({ ...f, daily_goal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Región</label>
                <input value={form.region}
                  onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Descripción (opcional)</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400 resize-none"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
                  style={{ background: '#1B8A4B' }}>
                  {loading ? 'Creando...' : 'Crear campaña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
