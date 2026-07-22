'use client'

import { useState } from 'react'

export default function ApprovalForm({ token, quotationId, accent = '#1B8A4B', accentLight = '#f0fdf4', accentBorder = '#86efac', accentText = '#166534', companyLabel = 'Transccl' }: {
  token: string; quotationId: string
  accent?: string; accentLight?: string; accentBorder?: string; accentText?: string; companyLabel?: string
}) {
  const [mode, setMode] = useState<'idle' | 'accepting' | 'rejecting'>('idle')
  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  async function submit(response: 'accepted' | 'rejected') {
    if (!name.trim() || !rut.trim()) { setError('Nombre y RUT requeridos'); return }
    if (response === 'rejected' && !reason.trim()) { setError('Debes indicar el motivo del rechazo'); return }
    setLoading(true)
    setError('')

    const res = await fetch(`/api/quotation-approvals/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, responded_name: name.trim(), responded_rut: rut.trim(), rejection_reason: reason.trim() || null }),
    })

    setLoading(false)
    if (res.ok) {
      setDone(response)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error al procesar respuesta')
    }
  }

  if (done) {
    return (
      <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${done === 'accepted' ? accentBorder : '#fca5a5'}`, padding: 40, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: done === 'accepted' ? accentLight : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          {done === 'accepted'
            ? <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            : <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          }
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
          {done === 'accepted' ? '¡Cotización aceptada!' : 'Cotización rechazada'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          {done === 'accepted'
            ? 'Hemos registrado tu aceptación. Nos pondremos en contacto a la brevedad.'
            : 'Hemos registrado tu respuesta. Gracias por informarnos.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Tu respuesta</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
        Revisa el detalle del servicio y confirma tu decisión. Válido según Ley 19.799.
      </p>

      {/* Datos del firmante */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <Field label="Nombre completo del representante *" value={name} onChange={setName} />
        <Field label="RUT del representante *" value={rut} onChange={setRut} placeholder="12.345.678-9" />
      </div>

      {/* Motivo rechazo */}
      {mode === 'rejecting' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
            Motivo del rechazo *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Indica el motivo por el cual rechazas esta cotización..."
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Botones */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setMode('accepting')}
            style={{ flex: 1, padding: '13px 20px', borderRadius: 10, background: accent, color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            ✅ Aceptar cotización
          </button>
          <button
            onClick={() => setMode('rejecting')}
            style={{ flex: 1, padding: '13px 20px', borderRadius: 10, background: 'white', color: '#dc2626', border: '1.5px solid #fca5a5', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            ❌ Rechazar cotización
          </button>
        </div>
      )}

      {mode === 'accepting' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setMode('idle')} style={{ padding: '12px 20px', borderRadius: 10, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: 14, cursor: 'pointer' }}>
            Volver
          </button>
          <button
            onClick={() => submit('accepted')}
            disabled={loading}
            style={{ flex: 1, padding: '13px 20px', borderRadius: 10, background: loading ? '#9ca3af' : accent, color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Procesando...' : 'Confirmar aceptación'}
          </button>
        </div>
      )}

      {mode === 'rejecting' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setMode('idle')} style={{ padding: '12px 20px', borderRadius: 10, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: 14, cursor: 'pointer' }}>
            Volver
          </button>
          <button
            onClick={() => submit('rejected')}
            disabled={loading}
            style={{ flex: 1, padding: '13px 20px', borderRadius: 10, background: loading ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Procesando...' : 'Confirmar rechazo'}
          </button>
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        Tu respuesta queda registrada con nombre, RUT, fecha/hora e IP según Ley 19.799
      </p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', outline: 'none', fontFamily: 'inherit' }}
      />
    </div>
  )
}
