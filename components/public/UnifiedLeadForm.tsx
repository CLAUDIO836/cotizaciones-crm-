'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Utilidades RUT ──────────────────────────────────────────────────────────
function validateRut(raw: string): boolean {
  const clean = raw.replace(/\./g, '').replace(/-/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const rem = 11 - (sum % 11)
  const expected = rem === 11 ? '0' : rem === 10 ? 'K' : String(rem)
  return dv === expected
}
function formatRut(value: string): string {
  const clean = value.replace(/[^\dkK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

// ── Google Maps autocomplete ────────────────────────────────────────────────
interface PlaceField { address: string; placeId?: string; lat?: number; lng?: number; validated: boolean }
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
        const preds: Prediction[] = (data.predictions ?? []).map((p: Prediction) => ({ description: p.description, place_id: p.place_id }))
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
      onChange({ address: pred.description, placeId: pred.place_id, lat: loc?.lat, lng: loc?.lng, validated: true })
    } catch {
      onChange({ address: pred.description, placeId: pred.place_id, validated: true })
    }
  }

  return { suggestions, open, setOpen, handleChange, select }
}

function AddressField({ label, required, value, onChange, placeholder }: {
  label: string; required?: boolean; value: PlaceField; onChange: (v: PlaceField) => void; placeholder?: string
}) {
  const { suggestions, open, setOpen, handleChange, select } = usePlaceAutocomplete(value, onChange)
  const s = inputStyle
  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{label} {required && <span style={{ color: '#e53e3e' }}>*</span>}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s, paddingRight: 36, borderColor: value.address.length > 2 ? (value.validated ? '#1B8A4B' : '#e2e8f0') : '#e2e8f0' }}
          value={value.address}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {value.address.length > 2 && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>
            {value.validated ? '✅' : '📍'}
          </span>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 100, left: 0, right: 0, background: '#fff', border: '1.5px solid #cbd5e0', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
          {suggestions.map(p => (
            <button key={p.place_id} type="button" onMouseDown={() => select(p)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13, color: '#2d3748' }}>
              📍 {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e2e8f0',
  borderRadius: 8, outline: 'none', color: '#1a202c', background: '#fff',
  boxSizing: 'border-box', appearance: 'none' as const, WebkitAppearance: 'none' as const,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4,
}
const pillActive = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '9px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center' as const,
  border: active ? '2px solid #1B8A4B' : '2px solid #e2e8f0',
  background: active ? '#f0fff4' : '#fff',
  fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#166534' : '#4a5568',
  transition: 'all 0.15s', fontFamily: 'inherit',
})

const VEHICULOS = [
  { value: 'bus45',     label: '🚌 Bus',        cap: 'hasta 45 pasajeros', min: 36, max: 45 },
  { value: 'taxibus30', label: '🚐 Taxibús',     cap: 'hasta 30 pasajeros', min: 21, max: 35 },
  { value: 'minibus19', label: '🚐 Minibús 19',  cap: 'hasta 19 pasajeros', min: 16, max: 20 },
  { value: 'minibus15', label: '🚐 Minibús 15',  cap: 'hasta 15 pasajeros', min: 12, max: 15 },
  { value: 'minivan10', label: '🚙 Minivan',     cap: 'hasta 10 pasajeros', min: 8,  max: 11 },
  { value: 'minivan7',  label: '🚗 Minivan 7',   cap: 'hasta 7 pasajeros',  min: 1,  max: 7  },
  { value: 'sin_pref',  label: '🤷 Sin preferencia', cap: 'lo que recomienden', min: 0, max: 999 },
]

function suggestVehicle(pax: number): string {
  const opt = VEHICULOS.filter(v => v.value !== 'sin_pref').find(v => pax <= v.max) ?? VEHICULOS[0]
  return opt.value
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  phone?: string
  company: { key: string; name: string; color?: string }
}

type ClientType  = 'natural' | 'empresa' | 'colegio' | ''
type ServicioTipo = 'viaje_especial' | 'salida_educativa' | 'traslado_diario' | ''
type UtmSource   = 'facebook' | 'instagram' | 'google' | 'sofia' | 'web' | 'otro' | ''

const SVC_DESC: Record<string, string> = {
  viaje_especial:   'Paseo, turismo, evento, traslado puntual.',
  salida_educativa: 'Excursión escolar o actividad extraprogramática.',
  traslado_diario:  'Ruta fija recurrente para trabajadores.',
}

export default function UnifiedLeadForm({ phone, company }: Props) {
  const accent = company.color ?? '#1B8A4B'

  // ── Estados ──────────────────────────────────────────────────────────────
  const [step, setStep]           = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [saving, setSaving]       = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const [utmSource, setUtmSource] = useState<UtmSource>('')
  const [utmFromUrl, setUtmFromUrl] = useState(false)

  const [clientType, setClientType]   = useState<ClientType>('')
  const [nombre, setNombre]           = useState('')
  const [rut, setRut]                 = useState('')
  const [rutError, setRutError]       = useState('')
  const [contacto, setContacto]       = useState('')
  const [cargo, setCargo]             = useState('')
  const [telefono, setTelefono]       = useState('')
  const [email, setEmail]             = useState('')

  const [servicioTipo, setServicioTipo] = useState<ServicioTipo>('')

  // Viaje especial / Salida educativa
  const [origin, setOrigin]         = useState<PlaceField>(emptyPlace())
  const [dest, setDest]             = useState<PlaceField>(emptyPlace())
  const [tripType, setTripType]     = useState<'one_way' | 'round_trip' | 'full_day'>('one_way')
  const [fechaSalida, setFechaSalida] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [fechaRetorno, setFechaRetorno] = useState('')
  const [horaRetorno, setHoraRetorno] = useState('')
  const [pasajeros, setPasajeros]   = useState('')
  const [vehiculo, setVehiculo]     = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [serviceKm, setServiceKm]   = useState<number | null>(null)
  const [kmLoading, setKmLoading]   = useState(false)

  // Traslado diario
  const [descripcionProyecto, setDescripcionProyecto] = useState('')
  const [fechaImpl, setFechaImpl]   = useState('')
  const [archivoName, setArchivoName] = useState('')

  // ── Auto-detectar UTM desde URL ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const src = params.get('utm_source') as UtmSource | null
    if (src) { setUtmSource(src); setUtmFromUrl(true) }
  }, [])

  // ── Cargar datos previos para flujo Sofía ───────────────────────────────
  useEffect(() => {
    if (!phone) { setStep('form'); return }
    fetch(`/api/form/${phone}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.data) {
          const f = d.data
          if (f.client_type) setClientType(f.client_type as ClientType)
          if (f.contact_name)  setNombre(f.contact_name)
          if (f.contact_rut)   setRut(f.contact_rut)
          if (f.company_name)  setNombre(f.company_name)
          if (f.contact_email) setEmail(f.contact_email)
          if (f.contact_phone) setTelefono(f.contact_phone)
          if (f.service_origin) setOrigin({ address: f.service_origin, placeId: f.service_origin_place_id ?? undefined, lat: f.service_origin_lat ?? undefined, lng: f.service_origin_lng ?? undefined, validated: !!f.service_origin_place_id })
          if (f.service_destination) setDest({ address: f.service_destination, placeId: f.service_destination_place_id ?? undefined, lat: f.service_destination_lat ?? undefined, lng: f.service_destination_lng ?? undefined, validated: !!f.service_destination_place_id })
          if (f.service_date)  setFechaSalida(f.service_date)
          if (f.service_hour)  setHoraSalida(f.service_hour.substring(0, 5))
          if (f.service_date_return || f.service_hour_return) { setTripType('round_trip'); if (f.service_date_return) setFechaRetorno(f.service_date_return); if (f.service_hour_return) setHoraRetorno(f.service_hour_return.substring(0, 5)) }
          if (f.service_passengers) setPasajeros(String(f.service_passengers))
          if (f.service_vehicle)    setVehiculo(f.service_vehicle)
          if (f.observaciones)      setObservaciones(f.observaciones)
          if (f.tipo_servicio)      setServicioTipo(f.tipo_servicio as ServicioTipo)
          if (f.utm_source)         { setUtmSource(f.utm_source as UtmSource); setUtmFromUrl(true) }
        }
        setStep('form')
      })
      .catch(() => setStep('form'))
  }, [phone])

  // ── Calcular km cuando cambian coordenadas ───────────────────────────────
  useEffect(() => {
    if (!origin.validated || !dest.validated || !origin.placeId || !dest.placeId) { setServiceKm(null); return }
    setKmLoading(true)
    fetch(`/api/places?origin=${encodeURIComponent(origin.placeId)}&destination=${encodeURIComponent(dest.placeId)}`)
      .then(r => r.json())
      .then(d => { if (d.distance_m) setServiceKm(Math.round(d.distance_m / 100) / 10) })
      .catch(() => setServiceKm(null))
      .finally(() => setKmLoading(false))
  }, [origin.placeId, origin.validated, dest.placeId, dest.validated])

  // ── Sugerir vehículo por pasajeros ───────────────────────────────────────
  function handlePasajeros(val: string) {
    setPasajeros(val)
    const n = parseInt(val)
    if (n > 0) setVehiculo(suggestVehicle(n))
  }

  // ── Validación ───────────────────────────────────────────────────────────
  function getMissing(): string[] {
    const m: string[] = []
    if (!utmSource)    m.push('¿Cómo nos encontraste?')
    if (!clientType)   m.push('Tipo de cliente')
    if (!nombre.trim()) m.push(clientType === 'colegio' ? 'Nombre del establecimiento' : clientType === 'empresa' ? 'Razón social' : 'Nombre completo')
    if (rut && !validateRut(rut)) m.push('RUT (formato inválido)')
    if (!servicioTipo) m.push('Tipo de servicio')
    if (servicioTipo === 'traslado_diario') {
      if (!descripcionProyecto.trim()) m.push('Descripción del proyecto')
    } else if (servicioTipo) {
      if (!origin.address.trim()) m.push('Punto de inicio')
      if (!dest.address.trim())   m.push('Destino')
      if (!fechaSalida)                                   m.push('Fecha de salida')
      if (!horaSalida && tripType !== 'full_day')         m.push('Hora de salida')
      if (!pasajeros)                                     m.push('N° de pasajeros')
      if (tripType === 'round_trip' && !fechaRetorno)     m.push('Fecha de retorno')
      if (tripType === 'round_trip' && !horaRetorno)      m.push('Hora de retorno')
    }
    return m
  }

  // ── Enviar ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing = getMissing()
    if (missing.length > 0) { setShowValidation(true); return }
    if (submitted) return
    setSaving(true); setSubmitError('')

    const payload: Record<string, unknown> = {
      utm_source:   utmSource,
      tipo_cliente: clientType,
      tipo_servicio: servicioTipo,
    }

    // Datos del cliente
    const isEmpresa  = clientType === 'empresa'
    const isColegio  = clientType === 'colegio'
    const isNatural  = clientType === 'natural'

    payload.empresa_nombre   = isNatural ? null : nombre.trim() || null
    payload.empresa_rut      = rut.trim() || null
    payload.contacto_nombre  = isNatural ? nombre.trim() : contacto.trim() || null
    payload.contacto_cargo   = cargo.trim() || null
    payload.contacto_email   = email.trim() || null
    payload.contacto_telefono = telefono.trim() || null

    // Sofía usa nombres distintos
    if (phone) {
      payload.client_type  = clientType
      payload.company_name = isNatural ? null : nombre.trim() || null
      payload.contact_name = isNatural ? nombre.trim() : contacto.trim() || null
      payload.contact_rut  = rut.trim() || null
      payload.contact_email  = email.trim() || null
      payload.contact_phone  = telefono.trim() || null
      payload.contact_cargo  = cargo.trim() || null
    }

    if (servicioTipo === 'traslado_diario') {
      payload.observaciones       = descripcionProyecto.trim() || null
      payload.fecha_implementacion = fechaImpl || null
    } else if (servicioTipo) {
      payload.desde    = origin.address.trim() || null
      payload.hasta    = dest.address.trim() || null
      payload.service_origin                    = origin.address.trim() || null
      payload.service_origin_place_id           = origin.placeId ?? null
      payload.service_origin_lat                = origin.lat ?? null
      payload.service_origin_lng                = origin.lng ?? null
      payload.service_destination               = dest.address.trim() || null
      payload.service_destination_place_id      = dest.placeId ?? null
      payload.service_destination_lat           = dest.lat ?? null
      payload.service_destination_lng           = dest.lng ?? null
      payload.fecha_inicio        = fechaSalida || null
      payload.service_date        = fechaSalida || null
      payload.service_hour        = horaSalida || null
      payload.service_date_return = tripType === 'round_trip' ? (fechaRetorno || null)
                                  : tripType === 'full_day'   ? (fechaSalida  || null)
                                  : null
      payload.service_hour_return = tripType === 'round_trip' ? (horaRetorno || null) : null
      payload.pasajeros_aprox    = parseInt(pasajeros) || null
      payload.service_passengers = parseInt(pasajeros) || null
      payload.service_vehicle    = vehiculo || null
      payload.service_km         = serviceKm
      payload.observaciones      = observaciones.trim() || null
    }

    try {
      const url   = phone ? `/api/form/${phone}` : '/api/lead-requests'
      const extra = phone ? {} : { target_company: company.key }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...extra }),
      })
      let d: { ok?: boolean; error?: string } = {}
      try { d = await r.json() } catch { /* non-json */ }
      if (d.ok) { setSubmitted(true); setStep('done') }
      else {
        setSubmitError(d.error ?? (r.ok ? 'Error al enviar.' : `Error del servidor (${r.status}).`))
        setSaving(false)
      }
    } catch {
      setSubmitError('Sin conexión. Verifica tu internet e intenta nuevamente.')
      setSaving(false)
    }
  }

  // ── Auto-resize para iframe: reporta altura real al padre vía postMessage ──
  const postHeight = useCallback(() => {
    const h = document.documentElement.scrollHeight
    window.parent.postMessage({ type: 'resize', height: h }, '*')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    postHeight()
    const obs = new ResizeObserver(postHeight)
    obs.observe(document.body)
    return () => obs.disconnect()
  }, [postHeight, step, clientType, servicioTipo])

  // ── Pantallas especiales ─────────────────────────────────────────────────
  if (step === 'loading') return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc' }}>
      <div style={{ color: '#718096', fontSize: 14 }}>Cargando…</div>
    </div>
  )
  if (step === 'error') return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc', padding: 24 }}>
      <div style={{ textAlign: 'center', color: '#e53e3e', fontSize: 14 }}>Link inválido. Por favor contacta a TransCCL directamente.</div>
    </div>
  )
  if (step === 'done') return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0fff4', padding: 24 }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#22543d', textAlign: 'center' }}>¡Gracias{nombre ? `, ${nombre.split(' ')[0]}` : ''}!</h2>
      <p style={{ color: '#276749', fontSize: 14, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
        Recibimos tu solicitud. Un ejecutivo de {company.name} te contactará muy pronto.
      </p>
    </div>
  )

  const missing = getMissing()
  const today   = new Date().toISOString().split('T')[0]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100svh', background: '#f5f6f8', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 13 }}>

      {/* Header */}
      <div style={{ background: accent, padding: '12px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'white', flexShrink: 0 }}>T</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Solicita tu cotización</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', marginTop: 1 }}>Te respondemos en menos de 24 horas</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 12px 32px' }}>
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── Origen (solo si no viene por URL) ── */}
          {!utmFromUrl && (
            <div style={card}>
              <div style={cardHeader}>📡 ¿Cómo nos encontraste?</div>
              <div style={{ padding: '10px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {([['facebook','📘 Facebook'],['instagram','📸 Instagram'],['google','🔍 Google'],['sofia','💬 WhatsApp'],['otro','🌐 Otro']] as [UtmSource, string][]).map(([k,l]) => (
                  <button key={k} type="button" onClick={() => setUtmSource(k)}
                    style={{ padding: '5px 11px', border: `2px solid ${utmSource === k ? accent : '#e2e8f0'}`, borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: utmSource === k ? '#f0fff4' : '#fff', color: utmSource === k ? '#166534' : '#4a5568', cursor: 'pointer', transition: 'all .15s' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Tipo de cliente ── */}
          <div style={card}>
            <div style={cardHeader}>👤 ¿Quién cotiza?</div>
            <div style={{ padding: '10px 12px', display: 'flex', gap: 7 }}>
              {([['empresa','🏢','Empresa'],['natural','👤','Persona Natural'],['colegio','🏫','Colegio']] as [ClientType, string, string][]).map(([k,ico,l]) => (
                <button key={k} type="button" onClick={() => setClientType(k)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '9px 6px', border: `2px solid ${clientType === k ? accent : '#e2e8f0'}`, borderRadius: 8, background: clientType === k ? '#f0fff4' : '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  <span style={{ fontSize: 18 }}>{ico}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: clientType === k ? '#166534' : '#4a5568', textAlign: 'center' as const }}>{l}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Datos del cliente ── */}
          {clientType && (
            <div style={card}>
              <div style={cardHeader}>
                {clientType === 'empresa' ? '🏢 Datos de la empresa' : clientType === 'colegio' ? '🏫 Datos del establecimiento' : '👤 Tus datos'}
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Nombre / razón social */}
                <div>
                  <label style={labelStyle}>
                    {clientType === 'empresa' ? 'Razón social' : clientType === 'colegio' ? 'Nombre del establecimiento' : 'Nombre completo'}{' '}
                    <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder={clientType === 'empresa' ? 'Empresa S.A.' : clientType === 'colegio' ? 'Colegio San José' : 'Juan Pérez González'} />
                </div>

                {/* RUT */}
                <div>
                  <label style={labelStyle}>
                    {clientType === 'empresa' ? 'RUT empresa' : clientType === 'colegio' ? 'RUT establecimiento' : 'RUT'}{' '}
                    <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <input style={{ ...inputStyle, borderColor: rutError ? '#e53e3e' : '#e2e8f0' }}
                    value={rut} onChange={e => { const f = formatRut(e.target.value); setRut(f); setRutError(f.length > 3 ? (validateRut(f) ? '' : 'RUT inválido') : '') }}
                    placeholder="76.123.456-7" inputMode="numeric" />
                  {rutError && <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }}>{rutError}</div>}
                </div>

                {/* Contacto (empresa y colegio) */}
                {clientType !== 'natural' && (
                  <div>
                    <label style={labelStyle}>Nombre de contacto <span style={{ color: '#e53e3e' }}>*</span></label>
                    <input style={inputStyle} value={contacto} onChange={e => setContacto(e.target.value)}
                      placeholder={clientType === 'colegio' ? 'Director / Coordinador' : 'Juan Pérez'} />
                  </div>
                )}

                {/* Cargo (empresa y colegio) */}
                {clientType !== 'natural' && (
                  <div>
                    <label style={labelStyle}>Cargo <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
                    <input style={inputStyle} value={cargo} onChange={e => setCargo(e.target.value)}
                      placeholder={clientType === 'colegio' ? 'Director, Coordinador de viajes…' : 'Gerente RR.HH.'} />
                  </div>
                )}

                {/* Teléfono */}
                <div>
                  <label style={labelStyle}>Teléfono / WhatsApp <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional — muy útil para resolver dudas)</span></label>
                  <input style={inputStyle} type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>Email <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional — para enviarte la cotización)</span></label>
                  <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contacto@empresa.cl" />
                </div>
              </div>
            </div>
          )}

          {/* ── Tipo de servicio ── */}
          {clientType && (
            <div style={card}>
              <div style={cardHeader}>🚌 ¿Qué servicio necesitas?</div>
              <div style={{ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {(['viaje_especial','salida_educativa','traslado_diario'] as ServicioTipo[])
                    .filter(s => !(clientType === 'natural' && s === 'traslado_diario'))
                    .map(s => {
                      const labels: Record<string, string> = { viaje_especial: '🎒 Viaje Especial', salida_educativa: '🏫 Salida Educativa', traslado_diario: '👷 Traslado Diario' }
                      return (
                        <button key={s} type="button" onClick={() => setServicioTipo(s)}
                          style={{ padding: '5px 11px', border: `2px solid ${servicioTipo === s ? accent : '#e2e8f0'}`, borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: servicioTipo === s ? '#f0fff4' : '#fff', color: servicioTipo === s ? '#166534' : '#4a5568', cursor: 'pointer', transition: 'all .15s' }}>
                          {labels[s]}
                        </button>
                      )
                    })}
                </div>
                {servicioTipo && <div style={{ fontSize: 11, color: '#718096' }}>{SVC_DESC[servicioTipo]}</div>}
              </div>
            </div>
          )}

          {/* ── Traslado Diario ── */}
          {servicioTipo === 'traslado_diario' && (
            <div style={card}>
              <div style={cardHeader}>📋 Cuéntanos tu proyecto</div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Descripción del proyecto <span style={{ color: '#e53e3e' }}>*</span></label>
                  <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' as const }}
                    value={descripcionProyecto} onChange={e => setDescripcionProyecto(e.target.value)}
                    placeholder="Ej: Traslado diario de 40 trabajadores desde Estación Central hasta planta en Pudahuel, turno mañana y tarde, lunes a viernes…" />
                </div>
                <div>
                  <label style={labelStyle}>Fecha de implementación prevista <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
                  <input style={inputStyle} type="date" value={fechaImpl} onChange={e => setFechaImpl(e.target.value)} min={today} />
                </div>
                <div>
                  <label style={labelStyle}>Adjuntar archivo <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: `1.5px dashed ${archivoName ? accent : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', background: archivoName ? '#f0fff4' : '#f5f6f8', fontSize: 12, fontWeight: 600, color: archivoName ? '#166534' : '#4a5568' }}>
                    <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={e => setArchivoName(e.target.files?.[0]?.name ?? '')} />
                    📎 {archivoName || 'Adjuntar archivo'}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Viaje Especial / Salida Educativa ── */}
          {(servicioTipo === 'viaje_especial' || servicioTipo === 'salida_educativa') && (
            <div style={card}>
              <div style={cardHeader}>📍 Datos del servicio</div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Ruta */}
                <AddressField label="Punto de inicio" required value={origin} onChange={setOrigin} placeholder="Ej: Las Condes, Santiago" />
                <AddressField label="Destino" required value={dest} onChange={setDest} placeholder="Ej: Pudahuel, Santiago" />
                {(kmLoading || serviceKm !== null) && (
                  <div style={{ fontSize: 12, color: '#2b6cb0', background: '#ebf8ff', borderRadius: 20, padding: '3px 10px', display: 'inline-block', fontWeight: 600 }}>
                    {kmLoading ? '📍 Calculando distancia…' : `🛣 ${serviceKm} km por ruta`}
                  </div>
                )}

                {/* Ida / vuelta */}
                <div>
                  <label style={labelStyle}>Tipo de viaje <span style={{ color: '#e53e3e' }}>*</span></label>
                  <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <button type="button" style={pillActive(tripType === 'one_way')}    onClick={() => setTripType('one_way')}>Solo ida</button>
                    <button type="button" style={{ ...pillActive(tripType === 'round_trip'), borderLeft: '1.5px solid #e2e8f0' }} onClick={() => setTripType('round_trip')}>Ida y vuelta</button>
                    <button type="button" style={{ ...pillActive(tripType === 'full_day'),   borderLeft: '1.5px solid #e2e8f0' }} onClick={() => setTripType('full_day')}>Por el día</button>
                  </div>
                </div>

                {/* Fecha + hora salida */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Fecha salida <span style={{ color: '#e53e3e' }}>*</span></label>
                    <input style={{ ...inputStyle, paddingRight: 6 }} type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} min={today} />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Hora salida{' '}
                      {tripType !== 'full_day'
                        ? <span style={{ color: '#e53e3e' }}>*</span>
                        : <span style={{ color: '#718096', fontWeight: 400 }}>(opcional)</span>}
                    </label>
                    <input style={{ ...inputStyle, paddingRight: 6 }} type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
                  </div>
                </div>

                {/* Fecha + hora retorno */}
                {tripType === 'round_trip' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Fecha retorno <span style={{ color: '#e53e3e' }}>*</span></label>
                      <input style={{ ...inputStyle, paddingRight: 6 }} type="date" value={fechaRetorno} onChange={e => setFechaRetorno(e.target.value)} min={fechaSalida || today} />
                    </div>
                    <div>
                      <label style={labelStyle}>Hora retorno <span style={{ color: '#e53e3e' }}>*</span></label>
                      <input style={{ ...inputStyle, paddingRight: 6 }} type="time" value={horaRetorno} onChange={e => setHoraRetorno(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Pasajeros */}
                <div>
                  <label style={labelStyle}>N° de pasajeros <span style={{ color: '#e53e3e' }}>*</span></label>
                  <input style={inputStyle} type="number" value={pasajeros} onChange={e => handlePasajeros(e.target.value)} placeholder="Ej: 35" min={1} max={200} />
                </div>

                {/* Vehículo */}
                <div>
                  <label style={labelStyle}>Vehículo preferido <span style={{ color: '#e53e3e' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select style={{ ...inputStyle, paddingRight: 28 }} value={vehiculo} onChange={e => setVehiculo(e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {VEHICULOS.map(v => <option key={v.value} value={v.value}>{v.label} — {v.cap}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#718096', pointerEvents: 'none', fontSize: 11 }}>▾</span>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label style={labelStyle}>Observaciones <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 400 }}>(opcional)</span></label>
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' as const }}
                    value={observaciones} onChange={e => setObservaciones(e.target.value)}
                    placeholder="Horarios específicos, puntos de parada, necesidades especiales…" />
                </div>
              </div>
            </div>
          )}

          {/* ── Validación ── */}
          {showValidation && missing.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff5f5', border: '1.5px solid #feb2b2' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c53030', marginBottom: 6 }}>⚠️ Faltan estos campos:</div>
              {missing.map(f => <div key={f} style={{ fontSize: 12, color: '#c53030', marginBottom: 2 }}>· {f}</div>)}
            </div>
          )}
          {submitError && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff5f5', border: '1.5px solid #feb2b2' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c53030' }}>❌ No se pudo enviar</div>
              <div style={{ fontSize: 12, color: '#c53030', marginTop: 3 }}>{submitError}</div>
            </div>
          )}

          {/* ── Enviar ── */}
          <button type="submit" disabled={saving}
            style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, background: saving ? '#9ae6b4' : accent, color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Enviando…' : 'Enviar solicitud →'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#a0aec0', margin: '4px 0 0' }}>
            Tus datos son confidenciales y solo se usarán para tu cotización.
          </p>

        </form>
      </div>
    </div>
  )
}

// ── Card styles ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
}
const cardHeader: React.CSSProperties = {
  padding: '7px 12px', borderBottom: '1px solid #e5e7eb',
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.06em', color: '#9ca3af',
}
