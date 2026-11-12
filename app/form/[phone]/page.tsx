'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

const TIPOS = [
  'Traslado escolar / educacional',
  'Traslado empresarial',
  'Tour / turismo',
  'Evento privado',
  'Traslado aeropuerto',
  'Otro',
]

const VEHICULOS = [
  { id: 'bus',      label: 'Bus',       desc: 'Hasta 45 pasajeros',  icon: '🚌' },
  { id: 'minibusd', label: 'Minibús',   desc: 'Hasta 25 pasajeros',  icon: '🚐' },
  { id: 'taxibus',  label: 'Taxi-bus',  desc: 'Hasta 12 pasajeros',  icon: '🚎' },
  { id: 'notengo', label: 'Sin preferencia', desc: 'Lo que recomienden', icon: '🤷' },
]

interface PlaceField {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  validated: boolean
}
const emptyPlace = (): PlaceField => ({ address: '', validated: false })

interface Prediction { description: string; place_id: string }

function usePlaceAutocomplete(value: PlaceField, onChange: (v: PlaceField) => void) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleChange(text: string) {
    onChange({ address: text, validated: false })
    clearTimeout(timer.current)
    if (text.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(text)}`)
        const data = await res.json()
        const preds: Prediction[] = (data.predictions ?? []).map((p: Prediction) => ({
          description: p.description, place_id: p.place_id,
        }))
        setSuggestions(preds); setOpen(preds.length > 0)
      } catch { setSuggestions([]); setOpen(false) }
    }, 350)
  }

  async function select(pred: Prediction) {
    setSuggestions([]); setOpen(false)
    onChange({ address: pred.description, placeId: pred.place_id, validated: false })
    try {
      const res = await fetch(`/api/places?place_id=${encodeURIComponent(pred.place_id)}`)
      const data = await res.json()
      const loc = data.result?.geometry?.location
      onChange({
        address: pred.description,
        placeId: pred.place_id,
        lat: loc?.lat,
        lng: loc?.lng,
        validated: true,
      })
    } catch {
      onChange({ address: pred.description, placeId: pred.place_id, validated: true })
    }
  }

  return { suggestions, open, setOpen, handleChange, select }
}

function AddressFieldInline({
  label, required, value, onChange, placeholder, inputStyle, labelStyle,
}: {
  label: string; required?: boolean; value: PlaceField; onChange: (v: PlaceField) => void
  placeholder?: string; inputStyle: React.CSSProperties; labelStyle: React.CSSProperties
}) {
  const { suggestions, open, setOpen, handleChange, select } = usePlaceAutocomplete(value, onChange)
  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#e53e3e' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          style={{
            ...inputStyle,
            paddingRight: 36,
            borderColor: value.address.length > 2
              ? (value.validated ? '#38a169' : '#e2e8f0')
              : '#e2e8f0',
          }}
          value={value.address}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {value.address.length > 2 && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>
            {value.validated ? '✅' : '📍'}
          </span>
        )}
      </div>
      {!value.validated && value.address.length > 2 && !open && (
        <div style={{ fontSize: 11, color: '#718096', marginTop: 3 }}>
          Escribe y selecciona una sugerencia para validar la dirección
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 100, left: 0, right: 0,
          background: '#fff', border: '1.5px solid #cbd5e0', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 200, overflowY: 'auto',
        }}>
          {suggestions.map(p => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={() => select(p)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer', fontSize: 13, color: '#2d3748',
              }}
            >
              📍 {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FormPage() {
  const params   = useParams()
  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone
  const phone    = rawPhone?.replace(/\D/g, '') ?? ''

  const [step, setStep]     = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [saving, setSaving] = useState(false)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [origin,   setOrigin]   = useState<PlaceField>(emptyPlace())
  const [dest,     setDest]     = useState<PlaceField>(emptyPlace())
  const [date,     setDate]     = useState('')
  const [pax,      setPax]      = useState('')
  const [tipo,     setTipo]     = useState('')
  const [vehiculo, setVehiculo] = useState('')

  useEffect(() => {
    if (!phone) { setStep('error'); return }
    fetch(`/api/form/${phone}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.data) {
          const f = d.data
          if (f.contact_name)        setName(f.contact_name)
          if (f.contact_email)       setEmail(f.contact_email)
          if (f.service_origin)      setOrigin({
            address: f.service_origin,
            placeId: f.service_origin_place_id ?? undefined,
            lat: f.service_origin_lat ?? undefined,
            lng: f.service_origin_lng ?? undefined,
            validated: !!f.service_origin_place_id,
          })
          if (f.service_destination) setDest({
            address: f.service_destination,
            placeId: f.service_destination_place_id ?? undefined,
            lat: f.service_destination_lat ?? undefined,
            lng: f.service_destination_lng ?? undefined,
            validated: !!f.service_destination_place_id,
          })
          if (f.service_date)        setDate(f.service_date)
          if (f.service_passengers)  setPax(String(f.service_passengers))
          if (f.service_type)        setTipo(f.service_type)
          if (f.service_vehicle)     setVehiculo(f.service_vehicle)
        }
        setStep('form')
      })
      .catch(() => setStep('form'))
  }, [phone])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !origin.address.trim() || !dest.address.trim() || !date || !pax || !tipo) return
    setSaving(true)
    try {
      const r = await fetch(`/api/form/${phone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: name.trim(),
          contact_email: email.trim() || null,
          service_origin: origin.address.trim(),
          service_origin_place_id: origin.placeId ?? null,
          service_origin_lat: origin.lat ?? null,
          service_origin_lng: origin.lng ?? null,
          service_destination: dest.address.trim(),
          service_destination_place_id: dest.placeId ?? null,
          service_destination_lat: dest.lat ?? null,
          service_destination_lng: dest.lng ?? null,
          service_date: date,
          service_passengers: parseInt(pax) || null,
          service_type: tipo,
          service_vehicle: vehiculo || null,
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
    boxSizing: 'border-box', appearance: 'none' as const, WebkitAppearance: 'none' as const,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 5,
  }

  if (step === 'loading') return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc' }}>
      <div style={{ color: '#718096', fontSize: 15 }}>Cargando…</div>
    </div>
  )

  if (step === 'error') return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc', padding: 24 }}>
      <div style={{ textAlign: 'center', color: '#e53e3e', fontSize: 15 }}>
        Link inválido. Por favor contacta a TransCCL directamente.
      </div>
    </div>
  )

  if (step === 'done') return (
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

  const canSubmit = name.trim() && origin.address.trim() && dest.address.trim() && date && pax && tipo

  return (
    <div style={{ minHeight: '100svh', background: '#f7fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1B8A4B', padding: '20px 24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            TransCCL · Traslado de Personas
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>Completa tu solicitud</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            Rellena el formulario y recibirás tu cotización por WhatsApp.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 40px' }}>
        <form onSubmit={handleSubmit}>

          {/* Datos personales */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Nombre completo <span style={{ color: '#e53e3e' }}>*</span></label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="Tu nombre completo" required autoComplete="name" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Correo electrónico <span style={{ color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com" autoComplete="email" />
          </div>

          {/* Detalles del viaje */}
          <div style={{ background: '#ebf8ff', borderRadius: 12, padding: '16px 16px 4px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2b6cb0', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📍 Detalles del viaje
            </div>

            <div style={{ marginBottom: 14 }}>
              <AddressFieldInline
                label="Lugar de partida" required
                value={origin} onChange={setOrigin}
                placeholder="Ciudad o dirección de salida"
                inputStyle={inputStyle} labelStyle={labelStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <AddressFieldInline
                label="Destino" required
                value={dest} onChange={setDest}
                placeholder="Ciudad o dirección de llegada"
                inputStyle={inputStyle} labelStyle={labelStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Fecha <span style={{ color: '#e53e3e' }}>*</span></label>
                <input style={{ ...inputStyle, paddingRight: 8 }} type="date" value={date}
                  onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} required />
              </div>
              <div>
                <label style={labelStyle}>N° pasajeros <span style={{ color: '#e53e3e' }}>*</span></label>
                <input style={inputStyle} type="number" value={pax} onChange={e => setPax(e.target.value)}
                  placeholder="Ej: 45" min={1} max={120} required />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tipo de servicio <span style={{ color: '#e53e3e' }}>*</span></label>
              <select style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718096' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}
                value={tipo} onChange={e => setTipo(e.target.value)} required>
                <option value="">Selecciona una opción…</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Tipo de vehículo */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>
              🚌 ¿Qué tipo de vehículo necesitas? <span style={{ color: '#a0aec0', fontWeight: 400 }}>(opcional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {VEHICULOS.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVehiculo(vehiculo === v.id ? '' : v.id)}
                  style={{
                    padding: '12px 10px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: vehiculo === v.id ? '2px solid #1B8A4B' : '2px solid #e2e8f0',
                    background: vehiculo === v.id ? '#f0fff4' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{v.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: vehiculo === v.id ? '#166534' : '#2d3748' }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: '#718096', marginTop: 1 }}>{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !canSubmit}
            style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
              background: saving || !canSubmit ? '#9ae6b4' : '#1B8A4B', color: '#fff',
              border: 'none', borderRadius: 12, cursor: saving || !canSubmit ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#a0aec0', marginTop: 14 }}>
            Tus datos son confidenciales y solo serán usados para tu cotización.
          </p>
        </form>
      </div>
    </div>
  )
}
