'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2 } from 'lucide-react'

export interface CompanyConfig {
  key: 'transccl' | 'tks' | 'trackingccl'
  name: string
  tagline: string
  color: string
  logoText: string
  email: string
}

const TIPOS_SERVICIO = [
  { key: 'traslado_diario',     label: 'Traslado Diario',        desc: 'Ruta fija recurrente (ej. casa-trabajo)' },
  { key: 'traslado_educativo',  label: 'Traslado Educativo',     desc: 'Alumnos, colegios o universidades' },
  { key: 'viaje_especial',      label: 'Viaje Especial',         desc: 'Evento, paseo, turismo u ocasión única' },
  { key: 'otro',                label: 'Otro',                   desc: 'Cuéntanos tu necesidad' },
]

const VEHICULOS = [
  { key: 'bus',             label: 'Bus (40–45 pax)' },
  { key: 'taxibus',         label: 'Taxibús (25–33 pax)' },
  { key: 'minibus',         label: 'Minibús (14–19 pax)' },
  { key: 'minivan',         label: 'Minivan (7–11 pax)' },
  { key: 'sin_preferencia', label: 'Sin preferencia / No sé' },
]

const FRECUENCIAS = [
  { key: 'diaria',           label: 'Todos los días hábiles' },
  { key: 'semanal',          label: 'Ciertos días de la semana' },
  { key: 'dias_especificos', label: 'Fechas específicas' },
  { key: 'unica',            label: 'Una sola vez' },
]

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

function validateRut(rut: string): boolean {
  const clean = rut.replace(/[.\-]/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const dvCalc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === dvCalc
}

export default function LeadRequestForm({ company }: { company: CompanyConfig }) {
  const [tipo, setTipo] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Empresa cliente
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaRut, setEmpresaRut] = useState('')
  const [rutError, setRutError] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoCargo, setContactoCargo] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')

  // Servicio
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [frecuencia, setFrecuencia] = useState('')
  const [diasSemana, setDiasSemana] = useState<string[]>([])
  const [pasajeros, setPasajeros] = useState('')
  const [vehiculo, setVehiculo] = useState('')

  // Educativo
  const [establecimiento, setEstablecimiento] = useState('')
  const [cantidadAlumnos, setCantidadAlumnos] = useState('')

  // Viaje especial
  const [motivoViaje, setMotivoViaje] = useState('')

  // Facturación
  const [requiereFactura, setRequiereFactura] = useState(false)
  const [facturaRazonSocial, setFacturaRazonSocial] = useState('')
  const [facturaRut, setFacturaRut] = useState('')
  const [facturaDireccion, setFacturaDireccion] = useState('')
  const [facturaGiro, setFacturaGiro] = useState('')
  const [facturaEmail, setFacturaEmail] = useState('')

  const [observaciones, setObservaciones] = useState('')

  function toggleDia(dia: string) {
    setDiasSemana(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia])
  }

  function handleRutBlur() {
    if (empresaRut && !validateRut(empresaRut)) {
      setRutError('RUT inválido')
    } else {
      setRutError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!tipo) errs.tipo = 'Selecciona el tipo de servicio'
    if (!empresaNombre.trim()) errs.empresaNombre = 'Requerido'
    if (!contactoNombre.trim()) errs.contactoNombre = 'Requerido'
    if (!contactoEmail.trim()) errs.contactoEmail = 'Requerido'
    if (!contactoTelefono.trim()) errs.contactoTelefono = 'Requerido'
    if (empresaRut && !validateRut(empresaRut)) errs.empresaRut = 'RUT inválido'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    setLoading(true)
    const res = await fetch('/api/lead-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_company: company.key,
        tipo_servicio: tipo,
        empresa_nombre: empresaNombre,
        empresa_rut: empresaRut || null,
        contacto_nombre: contactoNombre,
        contacto_cargo: contactoCargo || null,
        contacto_email: contactoEmail,
        contacto_telefono: contactoTelefono,
        desde: desde || null,
        hasta: hasta || null,
        fecha_inicio: fechaInicio || null,
        frecuencia: frecuencia || null,
        dias_semana: diasSemana.length > 0 ? diasSemana : null,
        pasajeros_aprox: pasajeros ? parseInt(pasajeros) : null,
        vehiculo_preferido: vehiculo || null,
        establecimiento_nombre: establecimiento || null,
        cantidad_alumnos: cantidadAlumnos ? parseInt(cantidadAlumnos) : null,
        motivo_viaje: motivoViaje || null,
        requiere_factura: requiereFactura,
        factura_razon_social: facturaRazonSocial || null,
        factura_rut: facturaRut || null,
        factura_direccion: facturaDireccion || null,
        factura_giro: facturaGiro || null,
        factura_email: facturaEmail || null,
        observaciones: observaciones || null,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      alert('Hubo un error al enviar. Por favor intenta de nuevo.')
    }
  }

  const accent = company.color

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f9fafb' }}>
        <div className="bg-white rounded-2xl border p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: accent + '15' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: accent }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h2>
          <p className="text-gray-500 mb-4">
            Recibimos tu cotización. Un ejecutivo de <strong>{company.name}</strong> se contactará contigo a la brevedad al correo <strong>{contactoEmail}</strong> y al teléfono <strong>{contactoTelefono}</strong>.
          </p>
          <p className="text-xs text-gray-400">{company.email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9fafb' }}>
      {/* Header */}
      <div className="py-6 px-4 text-white" style={{ background: accent }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
            {company.logoText}
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{company.name}</p>
            <p className="text-sm opacity-80">{company.tagline}</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Solicita tu cotización</h1>
          <p className="text-gray-500 text-sm mt-1">Completa el formulario y te contactamos en menos de 24 horas.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Tipo de servicio */}
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">¿Qué servicio necesitas?</h2>
            {errors.tipo && <p className="text-xs text-red-500">{errors.tipo}</p>}
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_SERVICIO.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipo(t.key)}
                  className="text-left p-3 rounded-xl border-2 transition-all"
                  style={tipo === t.key ? { borderColor: accent, background: accent + '08' } : { borderColor: '#e5e7eb' }}
                >
                  <p className="font-semibold text-sm text-gray-900">{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Datos empresa */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Tu empresa</h2>
            <div className="space-y-1.5">
              <Label>Razón social / Nombre empresa *</Label>
              <Input value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)} placeholder="Empresa S.A." />
              {errors.empresaNombre && <p className="text-xs text-red-500">{errors.empresaNombre}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>RUT empresa <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input value={empresaRut} onChange={e => setEmpresaRut(e.target.value)} onBlur={handleRutBlur} placeholder="76.123.456-7" />
              {(rutError || errors.empresaRut) && <p className="text-xs text-red-500">{rutError || errors.empresaRut}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre contacto *</Label>
                <Input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Juan Pérez" />
                {errors.contactoNombre && <p className="text-xs text-red-500">{errors.contactoNombre}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Cargo <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <Input value={contactoCargo} onChange={e => setContactoCargo(e.target.value)} placeholder="Gerente RR.HH." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={contactoEmail} onChange={e => setContactoEmail(e.target.value)} placeholder="juan@empresa.cl" />
                {errors.contactoEmail && <p className="text-xs text-red-500">{errors.contactoEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono / WhatsApp *</Label>
                <Input value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
                {errors.contactoTelefono && <p className="text-xs text-red-500">{errors.contactoTelefono}</p>}
              </div>
            </div>
          </div>

          {/* Detalle servicio */}
          {tipo && (
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Detalle del servicio</h2>

              {/* Educativo */}
              {tipo === 'traslado_educativo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nombre establecimiento</Label>
                    <Input value={establecimiento} onChange={e => setEstablecimiento(e.target.value)} placeholder="Colegio San José" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° alumnos aprox.</Label>
                    <Input type="number" min={1} value={cantidadAlumnos} onChange={e => setCantidadAlumnos(e.target.value)} placeholder="45" />
                  </div>
                </div>
              )}

              {/* Viaje especial */}
              {tipo === 'viaje_especial' && (
                <div className="space-y-1.5">
                  <Label>Motivo del viaje / Evento</Label>
                  <Input value={motivoViaje} onChange={e => setMotivoViaje(e.target.value)} placeholder="Paseo de fin de año, congreso, turismo..." />
                </div>
              )}

              {/* Ruta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Origen</Label>
                  <Input value={desde} onChange={e => setDesde(e.target.value)} placeholder="Ej: Las Condes, Santiago" />
                </div>
                <div className="space-y-1.5">
                  <Label>Destino</Label>
                  <Input value={hasta} onChange={e => setHasta(e.target.value)} placeholder="Ej: Pudahuel, Santiago" />
                </div>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label>{tipo === 'viaje_especial' ? 'Fecha del viaje' : 'Fecha de inicio'}</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>

              {/* Frecuencia (no para viaje especial) */}
              {tipo !== 'viaje_especial' && (
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FRECUENCIAS.map(f => (
                      <button key={f.key} type="button"
                        onClick={() => setFrecuencia(f.key)}
                        className="text-left px-3 py-2 rounded-lg border-2 text-sm transition-all"
                        style={frecuencia === f.key ? { borderColor: accent, color: accent, fontWeight: 600 } : { borderColor: '#e5e7eb', color: '#374151' }}
                      >{f.label}</button>
                    ))}
                  </div>
                  {frecuencia === 'semanal' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DIAS.map(d => (
                        <button key={d} type="button"
                          onClick={() => toggleDia(d)}
                          className="px-2.5 py-1 rounded-lg text-xs border-2 font-medium transition-all"
                          style={diasSemana.includes(d) ? { borderColor: accent, background: accent, color: 'white' } : { borderColor: '#e5e7eb', color: '#374151' }}
                        >{d.slice(0, 2)}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pasajeros + Vehículo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>N° pasajeros aprox.</Label>
                  <Input type="number" min={1} value={pasajeros} onChange={e => setPasajeros(e.target.value)} placeholder="45" />
                </div>
                <div className="space-y-1.5">
                  <Label>Vehículo preferido</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
                    value={vehiculo}
                    onChange={e => setVehiculo(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {VEHICULOS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Facturación */}
          {tipo && (
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requiere_factura"
                  checked={requiereFactura}
                  onChange={e => setRequiereFactura(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: accent }}
                />
                <Label htmlFor="requiere_factura" className="cursor-pointer">¿Requiere factura?</Label>
              </div>
              {requiereFactura && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Razón social</Label>
                      <Input value={facturaRazonSocial} onChange={e => setFacturaRazonSocial(e.target.value)} placeholder="Empresa S.A." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RUT</Label>
                      <Input value={facturaRut} onChange={e => setFacturaRut(e.target.value)} placeholder="76.123.456-7" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Giro</Label>
                    <Input value={facturaGiro} onChange={e => setFacturaGiro(e.target.value)} placeholder="Transporte de pasajeros" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dirección</Label>
                    <Input value={facturaDireccion} onChange={e => setFacturaDireccion(e.target.value)} placeholder="Av. Ejemplo 123, Santiago" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email facturación</Label>
                    <Input type="email" value={facturaEmail} onChange={e => setFacturaEmail(e.target.value)} placeholder="contabilidad@empresa.cl" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          {tipo && (
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <Label>Observaciones adicionales <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Horarios específicos, necesidades especiales, comentarios..."
                rows={3}
              />
            </div>
          )}

          {tipo && (
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold text-white"
              style={{ background: accent }}
            >
              {loading ? 'Enviando...' : 'Enviar solicitud de cotización'}
            </Button>
          )}

          <p className="text-xs text-center text-gray-400 pb-6">
            Al enviar aceptas que {company.name} se ponga en contacto contigo para entregar tu cotización.
          </p>
        </form>
      </div>
    </div>
  )
}
