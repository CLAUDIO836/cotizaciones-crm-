'use client'
import { useState } from 'react'

export default function CelularModal() {
  const [celular, setCelular] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (done) return null

  async function guardar() {
    const digits = celular.replace(/\D/g, '')
    if (digits.length < 8) return
    let normalized = celular.trim()
    if (digits.startsWith('56') && digits.length >= 10) normalized = `+${digits}`
    else if (digits.length === 8 || digits.length === 9) normalized = `+56${digits}`
    else if (!normalized.startsWith('+')) normalized = `+56${digits}`
    setSaving(true)
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ celular: normalized }),
    })
    setSaving(false)
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
        <div className="text-3xl mb-3 text-center">📱</div>
        <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
          Ingresa tu número de celular
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          Lo usamos para redirigirte las llamadas entrantes al CRM.
        </p>
        <input
          type="tel"
          value={celular}
          onChange={e => setCelular(e.target.value)}
          placeholder="9 1234 5678  (el +56 se agrega solo)"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
          onKeyDown={e => e.key === 'Enter' && guardar()}
          autoFocus
        />
        <button
          onClick={guardar}
          disabled={saving || celular.replace(/\D/g, '').length < 8}
          className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: '#1B8A4B' }}
        >
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  )
}
