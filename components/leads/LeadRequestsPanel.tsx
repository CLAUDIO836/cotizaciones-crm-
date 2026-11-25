'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Phone, Mail, MapPin, Users, Calendar, ChevronDown, ChevronUp,
  ExternalLink, Bot, Clock, Car, AlertTriangle, Globe, Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Lead = {
  id: string
  created_at?: string
  target_company?: string
  tipo_servicio?: string
  tipo_cliente?: string
  utm_source?: string
  empresa_nombre?: string
  empresa_rut?: string
  contacto_nombre?: string
  contacto_cargo?: string
  contacto_email?: string
  contacto_telefono?: string
  desde?: string
  hasta?: string
  fecha_inicio?: string
  service_hour?: string
  service_date_return?: string
  service_hour_return?: string
  service_vehicle?: string
  service_km?: number | string
  frecuencia?: string
  dias_semana?: string[]
  pasajeros_aprox?: string | number
  vehiculo_preferido?: string
  establecimiento_nombre?: string
  cantidad_alumnos?: number
  motivo_viaje?: string
  requiere_factura?: boolean
  factura_razon_social?: string
  factura_rut?: string
  observaciones?: string
  fecha_implementacion?: string
  status: string
  crm_notes?: string
  assigned_user_id?: string
  profiles?: { name: string } | null
}

type Seller = { id: string; name: string }

const COMPANY_COLORS: Record<string, string> = {
  transccl:   '#1B8A4B',
  tks:        '#C8102E',
  trackingccl:'#0ea5e9',
}
const COMPANY_LABELS: Record<string, string> = {
  transccl:   'Transccl',
  tks:        'TKS',
  trackingccl:'TrackingCCL',
}
const TIPO_LABELS: Record<string, string> = {
  traslado_diario:    'Traslado Diario',
  traslado_educativo: 'Traslado Educativo',
  salida_educativa:   'Salida Educativa',
  viaje_especial:     'Viaje Especial',
  otro:               'Otro',
}
const CLIENTE_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  natural: 'Persona Natural',
  colegio: 'Colegio',
}
const UTM_LABELS: Record<string, { label: string; color: string }> = {
  google:    { label: 'Google',    color: '#4285F4' },
  facebook:  { label: 'Facebook',  color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  web:       { label: 'Web',       color: '#6b7280' },
  sofia:     { label: 'Sofía WA',  color: '#1B8A4B' },
  whatsapp:  { label: 'WhatsApp', color: '#25D366' },
}
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   bg: '#fef9c3', color: '#854d0e' },
  en_revision: { label: 'En revisión', bg: '#dbeafe', color: '#1e40af' },
  convertido:  { label: 'Convertido',  bg: '#dcfce7', color: '#166534' },
  descartado:  { label: 'Descartado',  bg: '#f3f4f6', color: '#6b7280' },
}
const STATUS_OPTIONS = ['pendiente', 'en_revision', 'convertido', 'descartado']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(d: string) {
  // "2026-11-23" → "23/11/2026"
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function formatHour(h: string) {
  // "14:30:00" → "14:30"
  return h?.slice(0, 5) ?? h
}

/** Chips amarillos de campos críticos faltantes */
function MissingChips({ lead }: { lead: Lead }) {
  const isTraslado = lead.tipo_servicio === 'traslado_diario'
  const missing: string[] = []

  if (!isTraslado) {
    if (!lead.desde)           missing.push('Sin origen')
    if (!lead.hasta)           missing.push('Sin destino')
    if (!lead.fecha_inicio)    missing.push('Sin fecha')
    if (!lead.service_hour)    missing.push('Sin hora salida')
    if (!lead.pasajeros_aprox) missing.push('Sin pasajeros')
  } else {
    if (!lead.observaciones && !lead.empresa_nombre) missing.push('Sin descripción')
    if (!lead.fecha_implementacion) missing.push('Sin fecha impl.')
  }
  if (!lead.contacto_email && !lead.contacto_telefono) missing.push('Sin contacto')

  if (missing.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {missing.map(m => (
        <span key={m} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
          <AlertTriangle className="w-2.5 h-2.5" />{m}
        </span>
      ))}
    </div>
  )
}

function LeadCard({ lead, sellers }: { lead: Lead; sellers: Seller[] }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus]     = useState(lead.status)
  const [assignedId, setAssignedId] = useState(lead.assigned_user_id ?? '')
  const [notes, setNotes]       = useState(lead.crm_notes ?? '')
  const [saving, setSaving]     = useState(false)
  const [startingAgent, setStartingAgent] = useState(false)
  const router = useRouter()

  const accent      = COMPANY_COLORS[lead.target_company ?? ''] ?? '#6b7280'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.pendiente
  const isTraslado  = lead.tipo_servicio === 'traslado_diario'
  const utmInfo     = UTM_LABELS[lead.utm_source ?? '']

  async function handleStartAgent() {
    setStartingAgent(true)
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          channel: 'crm',
          priority: 'medium',
          subject: lead.empresa_nombre ?? lead.contacto_nombre ?? 'Lead',
        }),
      })
      const data = await res.json()
      if (data?.id) router.push(`/agente/conversaciones/${data.id}`)
    } finally {
      setStartingAgent(false)
    }
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/lead-requests/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, assigned_user_id: assignedId || null, crm_notes: notes }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="h-1" style={{ background: accent }} />

      <div className="p-4 space-y-3">
        {/* ── Fila header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: accent }}>
              {COMPANY_LABELS[lead.target_company ?? '']}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={statusStyle}>
              {statusStyle.label}
            </span>
            {lead.tipo_servicio && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                {TIPO_LABELS[lead.tipo_servicio] ?? lead.tipo_servicio}
              </span>
            )}
            {lead.tipo_cliente && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                {CLIENTE_LABELS[lead.tipo_cliente] ?? lead.tipo_cliente}
              </span>
            )}
            {utmInfo && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex items-center gap-1"
                style={{ background: utmInfo.color }}>
                <Globe className="w-2.5 h-2.5" />{utmInfo.label}
              </span>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {lead.created_at ? formatDate(lead.created_at) : ''}
            </p>
            {lead.profiles?.name && (
              <p className="text-xs text-gray-500 mt-0.5">→ {lead.profiles.name}</p>
            )}
          </div>
        </div>

        {/* ── Empresa / Nombre ── */}
        <div>
          <p className="font-bold text-gray-900 text-base leading-tight">
            {lead.empresa_nombre || lead.contacto_nombre}
          </p>
          {lead.empresa_rut && <p className="text-xs text-gray-400 mt-0.5">RUT: {lead.empresa_rut}</p>}
        </div>

        {/* ── Contacto ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {lead.contacto_nombre && lead.empresa_nombre && (
            <span className="flex items-center gap-1 text-gray-700">
              <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <strong>{lead.contacto_nombre}</strong>
              {lead.contacto_cargo && <span className="text-gray-400">· {lead.contacto_cargo}</span>}
            </span>
          )}
          {lead.contacto_email && (
            <a href={`mailto:${lead.contacto_email}`}
              className="flex items-center gap-1 text-blue-600 hover:underline">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />{lead.contacto_email}
            </a>
          )}
          {lead.contacto_telefono && (
            <a href={`tel:${lead.contacto_telefono}`}
              className="flex items-center gap-1 text-green-700 hover:underline">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{lead.contacto_telefono}
            </a>
          )}
        </div>

        {/* ── Caja de servicio (siempre visible) ── */}
        <div className="rounded-lg border p-3 space-y-2 text-sm"
          style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>

          {!isTraslado ? (
            <>
              {/* Ruta */}
              {(lead.desde || lead.hasta) && (
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                  <span>
                    <span className="font-medium">{lead.desde || '—'}</span>
                    {lead.hasta && (
                      <> → <span className="font-medium">{lead.hasta}</span></>
                    )}
                    {lead.service_km && (
                      <span className="ml-1.5 text-xs text-gray-400">({Number(lead.service_km).toFixed(0)} km)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Fecha + hora salida / retorno */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {lead.fecha_inicio
                    ? <strong>{formatShortDate(lead.fecha_inicio)}</strong>
                    : <span className="text-gray-400 italic">Sin fecha</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {lead.service_hour
                    ? <strong>{formatHour(lead.service_hour)}</strong>
                    : <span className="text-gray-400 italic">Sin hora salida</span>}
                </span>
                {lead.service_date_return && lead.service_date_return !== lead.fecha_inicio ? (
                  <>
                    <span className="text-gray-400">↩</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <strong>{formatShortDate(lead.service_date_return)}</strong>
                    </span>
                    {lead.service_hour_return && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <strong>{formatHour(lead.service_hour_return)}</strong>
                      </span>
                    )}
                  </>
                ) : lead.service_date_return === lead.fecha_inicio ? (
                  <span className="text-xs font-medium self-center"
                    style={{ color: '#1B8A4B', background: '#f0fdf4', padding: '1px 8px', borderRadius: 20 }}>
                    Por el día
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic self-center">Solo ida</span>
                )}
              </div>

              {/* Pasajeros + vehículo */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {lead.pasajeros_aprox
                    ? <><strong>{lead.pasajeros_aprox}</strong> pasajeros</>
                    : <span className="text-gray-400 italic">Sin pasajeros</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {lead.service_vehicle || lead.vehiculo_preferido
                    ? <strong>{lead.service_vehicle || lead.vehiculo_preferido}</strong>
                    : <span className="text-gray-400 italic">Vehículo no definido</span>}
                </span>
              </div>
            </>
          ) : (
            /* Traslado diario */
            <>
              {lead.fecha_implementacion && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>Implementación: <strong>{formatShortDate(lead.fecha_implementacion)}</strong></span>
                </div>
              )}
              {(lead.desde || lead.hasta) && (
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                  <span>
                    <span className="font-medium">{lead.desde || '—'}</span>
                    {lead.hasta && <> → <span className="font-medium">{lead.hasta}</span></>}
                  </span>
                </div>
              )}
              {lead.frecuencia && (
                <div className="flex items-center gap-2 text-gray-600 text-xs">
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {lead.frecuencia}
                  {lead.dias_semana?.length ? ` · ${lead.dias_semana.join(', ')}` : ''}
                </div>
              )}
            </>
          )}

          {/* Observaciones del cliente (siempre visible) */}
          {lead.observaciones && (
            <div className="pt-1 border-t" style={{ borderColor: '#e2e8f0' }}>
              <p className="text-xs text-gray-400 mb-0.5">Dice el cliente:</p>
              <p className="text-sm text-gray-700 leading-snug">{lead.observaciones}</p>
            </div>
          )}
        </div>

        {/* Chips de campos faltantes */}
        <MissingChips lead={lead} />

        {/* Toggle gestión interna */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Ocultar gestión interna' : 'Gestión interna'}
        </button>
      </div>

      {/* Panel gestión interna */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-4 space-y-3 bg-gray-50">
          {/* Datos extra (factura, establecimiento, etc.) */}
          {(lead.establecimiento_nombre || lead.cantidad_alumnos || lead.motivo_viaje || lead.requiere_factura) && (
            <div className="grid grid-cols-2 gap-3 text-sm mb-1">
              {lead.establecimiento_nombre && (
                <div><span className="text-gray-400 text-xs">Establecimiento</span><p className="font-medium">{lead.establecimiento_nombre}</p></div>
              )}
              {lead.cantidad_alumnos && (
                <div><span className="text-gray-400 text-xs">Alumnos</span><p className="font-medium">{lead.cantidad_alumnos}</p></div>
              )}
              {lead.motivo_viaje && (
                <div><span className="text-gray-400 text-xs">Motivo</span><p className="font-medium">{lead.motivo_viaje}</p></div>
              )}
              {lead.requiere_factura && (
                <div><span className="text-gray-400 text-xs">Factura</span><p className="font-medium">{lead.factura_razon_social} · {lead.factura_rut}</p></div>
              )}
            </div>
          )}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gestión interna</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Estado</label>
              <select className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Asignar vendedor</label>
              <select className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                value={assignedId} onChange={e => setAssignedId(e.target.value)}>
                <option value="">Sin asignar</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notas internas</label>
            <textarea className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white resize-none"
              rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Comentarios internos sobre este lead..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}
              style={{ background: accent }} className="text-white">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <a href={`/cotizaciones/nueva?lead_id=${lead.id}`} target="_blank">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Crear cotización
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={handleStartAgent} disabled={startingAgent}
              style={{ borderColor: '#BBF7D0', color: '#1B8A4B' }}>
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              {startingAgent ? 'Iniciando…' : 'Agente IA'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeadRequestsPanel({
  leads, sellers,
}: {
  leads: Lead[]
  sellers: Seller[]
}) {
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterCompany, setFilterCompany] = useState('')

  const companyFiltered = leads.filter(l =>
    filterCompany === '' || l.target_company === filterCompany
  )

  const countByStatus: Record<string, number> = {
    '':           companyFiltered.length,
    pendiente:    companyFiltered.filter(l => l.status === 'pendiente').length,
    en_revision:  companyFiltered.filter(l => l.status === 'en_revision').length,
    convertido:   companyFiltered.filter(l => l.status === 'convertido').length,
    descartado:   companyFiltered.filter(l => l.status === 'descartado').length,
  }

  const filtered = companyFiltered
    .filter(l => filterStatus === '' || l.status === filterStatus)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['', 'pendiente', 'en_revision', 'convertido', 'descartado'] as const).map(s => {
          const count = countByStatus[s] ?? 0
          const isActive = filterStatus === s
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
              style={isActive
                ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              {s === '' ? 'Todos' : STATUS_STYLES[s].label}
              <span className={`ml-1.5 text-xs rounded-full px-1.5 ${
                isActive
                  ? 'bg-white/25 text-white'
                  : s === 'pendiente' && count > 0
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
        <div className="ml-auto flex gap-2">
          {(['', 'transccl', 'tks', 'trackingccl'] as const).map(c => (
            <button key={c} onClick={() => setFilterCompany(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={filterCompany === c
                ? { background: COMPANY_COLORS[c] ?? '#374151', color: 'white', borderColor: COMPANY_COLORS[c] ?? '#374151' }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              {c === '' ? 'Todas' : COMPANY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Sin solicitudes</p>
          <p className="text-sm mt-1">Cuando llegue una solicitud desde el formulario público aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => (
            <LeadCard key={lead.id} lead={lead} sellers={sellers} />
          ))}
        </div>
      )}
    </div>
  )
}
