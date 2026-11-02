'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const TIPOS = [
  'Traslado escolar / educacional',
  'Traslado empresarial',
  'Tour / turismo',
  'Evento privado',
  'Traslado aeropuerto',
  'Otro',
]

export default function FormPage() {
  const params  = useParams()
  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone
  const phone   = rawPhone?.replace(/\D/g, '') ?? ''

  const [step, setStep]     = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [saving, setSaving] = useState(false)

  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [origin,  setOrigin]  = useState('')
  const [dest,    setDest]    = useState('')
  const [date,    setDate]    = useState('')
  const [pax,     setPax]     = useState('')
  const [tipo,    setTipo]    = useState('')

  useEffect(() => {
    if (!phone) { setStep('error'); return }
    fetch(`/api/form/${phone}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.data) {
          const f = d.data
          if (f.contact_name)        setName(f.contact_name)
          if (f.contact_email)       setEmail(f.contact_email)
          if (f.service_origin)      setOrigin(f.service_origin)
          if (f.service_destination) setDest(f.service_destination)
          if (f.service_date)        setDate(f.service_date)
          if (f.service_passengers)  setPax(String(f.service_passengers))
          if (f.service_type)        setTipo(f.service_type)
        }
        setStep('form')
      })
      .catch(() => setStep('form'))
  }, [phone])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !origin.trim() || !dest.trim() || !date || !pax || !tipo) return
    setSaving(true)
    try {
      const r = await fetch(`/api/form/${phone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: name.trim(),
          contact_email: email.trim() || null,
          service_origin: origin.trim(),
          service_destination: dest.trim(),
          service_date: date,
          service_passengers: parseInt(pax) || null,
          service_type: tipo,
        }),
      })
      const d = await r.json()
      if (d.ok) setStep('done')
      else setSaving(false)
    } catch {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontSize: 16, border: '1.5px solid #e2e8f0',
    borderRadius: 10, outline: 'none', color: '#1a202c', background: '#fff',
    boxSizing: 'border-box', appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 5,
  }
  const fieldStyle: React.CSSProperties = { marginBottom: 18 }

  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc' }}>
        <div style={{ color: '#718096', fontSize: 15 }}>Cargando…</div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc', padding: 24 }}>
        <div style={{ textAlign: 'center', color: '#e53e3e', fontSize: 15 }}>
          Link inválido. Por favor contacta a TransCCL directamente.
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0fff4', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#22543d', textAlign: 'center' }}>
          ¡Gracias, {name.split(' ')[0]}!
        </h2>
        <p style={{ color: '#276749', fontSize: 15, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
          Recibimos tus datos. Un ejecutivo de TransCCL te enviará la cotización muy pronto por WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f7fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1B8A4B', padding: '20px 24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            TransCCL · Traslado de Personas
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
            Completa tu solicitud
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            Rellena el formulario y recibirás tu cotización por WhatsApp.
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 40px' }}>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Nombre completo <span style={{ color: '#e53e3e' }}>*</span></label>
            <input
              style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="Tu nombre completo" required autoComplete="name"
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Correo electrónico <span style={{ color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
            <input
              style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com" autoComplete="email"
            />
          </div>

          <div style={{ background: '#ebf8ff', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2b6cb0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Detalles del viaje
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Lugar de partida <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                style={inputStyle} value={origin} onChange={e => setOrigin(e.target.value)}
                placeholder="Ciudad o dirección de salida" required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Destino <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                style={inputStyle} value={dest} onChange={e => setDest(e.target.value)}
                placeholder="Ciudad o dirección de llegada" required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Fecha <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  style={{ ...inputStyle, paddingRight: 8 }} type="date" value={date}
                  onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>N° pasajeros <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  style={inputStyle} type="number" value={pax} onChange={e => setPax(e.target.value)}
                  placeholder="Ej: 45" min={1} max={120} required
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tipo de servicio <span style={{ color: '#e53e3e' }}>*</span></label>
              <select
                style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718096' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}
                value={tipo} onChange={e => setTipo(e.target.value)} required
              >
                <option value="">Selecciona una opción…</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim() || !origin.trim() || !dest.trim() || !date || !pax || !tipo}
            style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
              background: saving ? '#9ae6b4' : '#1B8A4B', color: '#fff',
              border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#a0aec0', marginTop: 14 }}>
            Tus datos son confidenciales y solo serán usados para preparar tu cotización.
          </p>
        </form>
      </div>
    </div>
  )
}
