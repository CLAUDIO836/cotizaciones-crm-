'use client'

import { useState } from 'react'

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

type Letter = Record<string, string | number | null>

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</p>
    </div>
  )
}

export default function SigningFormStg({ letter, token }: { letter: Letter; token: string }) {
  const [signedName, setSignedName] = useState('')
  const [signedRut, setSignedRut] = useState('')
  const [billing, setBilling] = useState({ billing_name: '', billing_rut: '', billing_address: '', billing_glosa: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSign() {
    if (!signedName.trim() || !signedRut.trim()) {
      setError('Debes ingresar tu nombre y RUT para firmar.')
      return
    }
    if (!billing.billing_rut.trim()) {
      setError('Debes ingresar el RUT de facturación.')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch(`/api/stg/approval-letters/${token}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed_name: signedName.trim(), signed_rut: signedRut.trim(), ...billing }),
    })

    setLoading(false)
    if (res.ok) {
      setDone(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al firmar')
    }
  }

  if (done) {
    return (
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>¡Documento firmado exitosamente!</h2>
        <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 15 }}>Has aprobado el servicio de transporte.</p>
        <p style={{ color: '#6b7280', margin: 0, fontSize: 13 }}>Se ha registrado tu firma con validez legal según la Ley 19.799.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Datos del servicio */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Detalle del Servicio</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          <Row label="Empresa" value={letter.client_name as string} />
          {letter.client_rut && <Row label="RUT" value={letter.client_rut as string} />}
          {letter.desde && <Row label="Origen" value={letter.desde as string} />}
          {letter.hasta && <Row label="Destino" value={letter.hasta as string} />}
          {letter.fecha_salida && (
            <Row label="Fecha salida" value={`${letter.fecha_salida}${letter.hora_salida ? ` a las ${letter.hora_salida}` : ''}`} />
          )}
          {letter.fecha_retorno && (
            <Row label="Fecha retorno" value={`${letter.fecha_retorno}${letter.hora_retorno ? ` a las ${letter.hora_retorno}` : ''}`} />
          )}
          {letter.seller_name && <Row label="Ejecutivo" value={letter.seller_name as string} />}
        </div>
        {letter.total && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Valor total del servicio</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{formatCLP(Number(letter.total))}</span>
          </div>
        )}
      </div>

      {/* Facturación */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Datos de Facturación</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
          Ingrese los datos para emitir la factura del servicio.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Razón social / Nombre *" value={billing.billing_name} onChange={v => setBilling(b => ({ ...b, billing_name: v }))} placeholder={letter.client_name as string} />
          <Field label="RUT de facturación *" value={billing.billing_rut} onChange={v => setBilling(b => ({ ...b, billing_rut: v }))} placeholder={letter.client_rut as string ?? '12.345.678-9'} />
          <Field label="Dirección" value={billing.billing_address} onChange={v => setBilling(b => ({ ...b, billing_address: v }))} />
          <Field label="Glosa / detalle factura" value={billing.billing_glosa} onChange={v => setBilling(b => ({ ...b, billing_glosa: v }))} />
        </div>
      </div>

      {/* Firma */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Firma Digital</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
          Al firmar, declara haber leído y aceptado los términos y condiciones. Válido según Ley 19.799.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Nombre completo del representante *" value={signedName} onChange={setSignedName} />
          <Field label="RUT del representante *" value={signedRut} onChange={setSignedRut} placeholder="12.345.678-9" />
        </div>
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
            <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>{error}</p>
          </div>
        )}
        <button
          onClick={handleSign}
          disabled={loading}
          style={{
            marginTop: 16, width: '100%', padding: '14px 24px', borderRadius: 10,
            background: loading ? '#9ca3af' : '#1B8A4B', color: 'white', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Firmando...' : 'Firmar y aceptar servicio'}
        </button>
      </div>
    </div>
  )
}
