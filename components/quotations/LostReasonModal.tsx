'use client'

import { useState } from 'react'
import { X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REASONS = [
  'PRECIO',
  'NO SE ENVÍA COTIZACIÓN',
  'NO SE REALIZA SERVICIO',
  'RECHAZO INTERNO',
  'SIN RAZÓN',
  'SUSPENDIDO',
  'Otro...',
]

interface Props {
  onConfirm: (reason: string, comment: string) => void
  onClose: () => void
  loading?: boolean
}

export default function LostReasonModal({ onConfirm, onClose, loading }: Props) {
  const [reason,  setReason]  = useState('')
  const [comment, setComment] = useState('')
  const [error,   setError]   = useState('')

  function handleConfirm() {
    if (!reason) { setError('Selecciona una razón'); return }
    setError('')
    onConfirm(reason, comment.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h2 className="font-bold text-gray-900 text-sm">¿Por qué se perdió el negocio?</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 gap-1.5">
            {REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-sm transition-all"
                style={reason === r
                  ? { borderColor: '#D33A2C', background: '#fff1f0', color: '#b91c1c', fontWeight: 600 }
                  : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }}>
                <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: reason === r ? '#D33A2C' : '#d1d5db' }}>
                  {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                </div>
                {r}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Comentario (opcional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              placeholder="Detalle adicional..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end px-5 pb-5 border-t pt-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <Button onClick={handleConfirm} disabled={loading}
            className="text-white font-semibold text-sm"
            style={{ background: '#D33A2C' }}>
            <XCircle className="w-4 h-4 mr-1.5" />
            {loading ? 'Guardando...' : 'Marcar como perdido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
