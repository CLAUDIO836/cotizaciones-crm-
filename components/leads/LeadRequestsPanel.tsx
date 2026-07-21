'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Mail, MapPin, Users, Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Lead = {
  id: string
  created_at?: string
  target_company?: string
  tipo_servicio?: string
  empresa_nombre?: string
  empresa_rut?: string
  contacto_nombre?: string
  contacto_cargo?: string
  contacto_email?: string
  contacto_telefono?: string
  desde?: string
  hasta?: string
  fecha_inicio?: string
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
  status: string
  crm_notes?: string
  assigned_user_id?: string
  profiles?: { name: string } | null
}

type Seller = { id: string; name: string }

const COMPANY_COLORS: Record<string, string> = {
  transccl: '#1B8A4B',
  tks: '#C8102E',
  trackingccl: '#0ea5e9',
}
const COMPANY_LABELS: Record<string, string> = {
  transccl: 'Transccl',
  tks: 'TKS',
  trackingccl: 'TrackingCCL',
}
const TIPO_LABELS: Record<string, string> = {
  traslado_diario: 'Traslado Diario',
  traslado_educativo: 'Traslado Educativo',
  viaje_especial: 'Viaje Especial',
  otro: 'Otro',
}
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   bg: '#fef9c3', color: '#854d0e' },
  en_revision: { label: 'En revisión', bg: '#dbeafe', color: '#1e40af' },
  convertido:  { label: 'Convertido',  bg: '#dcfce7', color: '#166534' },
  descartado:  { label: 'Descartado',  bg: '#f3f4f6', color: '#6b7280' },
}

const STATUS_OPTIONS = ['pendiente', 'en_revision', 'convertido', 'descartado']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function LeadCard({ lead, sellers }: { lead: Lead; sellers: Seller[] }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(lead.status)
  const [assignedId, setAssignedId] = useState(lead.assigned_user_id ?? '')
  const [notes, setNotes] = useState(lead.crm_notes ?? '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const accent = COMPANY_COLORS[lead.target_company ?? ''] ?? '#6b7280'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.pendiente

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
      {/* Top bar color empresa */}
      <div className="h-1" style={{ background: accent }} />

      <div className="p-4">
        {/* Header fila */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: accent }}>
                {COMPANY_LABELS[lead.target_company ?? '']}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={statusStyle}>
                {statusStyle.label}
              </span>
              <span className="text-xs text-gray-400">{TIPO_LABELS[lead.tipo_servicio ?? ''] ?? lead.tipo_servicio}</span>
            </div>
            <p className="font-bold text-gray-900 text-base truncate">{lead.empresa_nombre}</p>
            {lead.empresa_rut && <p className="text-xs text-gray-400">RUT: {lead.empresa_rut}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">{lead.created_at ? formatDate(lead.created_at) : ''}</p>
            {lead.profiles?.name && <p className="text-xs text-gray-500 mt-0.5">→ {lead.profiles.name}</p>}
          </div>
        </div>

        {/* Contacto */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1 text-gray-700">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <strong>{lead.contacto_nombre}</strong>
            {lead.contacto_cargo && <span className="text-gray-400">· {lead.contacto_cargo}</span>}
          </span>
          <a href={`mailto:${lead.contacto_email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
            <Mail className="w-3.5 h-3.5" />{lead.contacto_email}
          </a>
          <a href={`tel:${lead.contacto_telefono}`} className="flex items-center gap-1 text-green-700 hover:underline">
            <Phone className="w-3.5 h-3.5" />{lead.contacto_telefono}
          </a>
        </div>

        {/* Ruta / resumen */}
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          {lead.desde && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{lead.desde}{lead.hasta ? ` → ${lead.hasta}` : ''}
            </span>
          )}
          {lead.pasajeros_aprox && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{lead.pasajeros_aprox} pax
            </span>
          )}
          {lead.fecha_inicio && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />{lead.fecha_inicio}
            </span>
          )}
        </div>

        {/* Toggle detalle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Ocultar detalle' : 'Ver detalle completo'}
        </button>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-4 space-y-4 bg-gray-50">
          {/* Info adicional */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.frecuencia && <div><span className="text-gray-400 text-xs">Frecuencia</span><p className="font-medium">{lead.frecuencia}</p></div>}
            {lead.dias_semana?.length && <div><span className="text-gray-400 text-xs">Días</span><p className="font-medium">{lead.dias_semana.join(', ')}</p></div>}
            {lead.vehiculo_preferido && <div><span className="text-gray-400 text-xs">Vehículo</span><p className="font-medium">{lead.vehiculo_preferido}</p></div>}
            {lead.establecimiento_nombre && <div><span className="text-gray-400 text-xs">Establecimiento</span><p className="font-medium">{lead.establecimiento_nombre}</p></div>}
            {lead.cantidad_alumnos && <div><span className="text-gray-400 text-xs">Alumnos</span><p className="font-medium">{lead.cantidad_alumnos}</p></div>}
            {lead.motivo_viaje && <div><span className="text-gray-400 text-xs">Motivo</span><p className="font-medium">{lead.motivo_viaje}</p></div>}
            {lead.requiere_factura && <div><span className="text-gray-400 text-xs">Factura</span><p className="font-medium">{lead.factura_razon_social} · {lead.factura_rut}</p></div>}
          </div>
          {lead.observaciones && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Observaciones del cliente</p>
              <p className="text-sm text-gray-700 bg-white border rounded-lg p-2.5">{lead.observaciones}</p>
            </div>
          )}

          {/* Gestión CRM */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gestión interna</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Estado</label>
                <select
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Asignar vendedor</label>
                <select
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                  value={assignedId}
                  onChange={e => setAssignedId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Notas internas</label>
              <textarea
                className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white resize-none"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Comentarios internos sobre este lead..."
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} style={{ background: accent }} className="text-white">
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
              <a href="/cotizaciones/nueva" target="_blank">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Crear cotización
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeadRequestsPanel({
  leads, sellers
}: {
  leads: Lead[]
  sellers: Seller[]
}) {
  const [filterStatus, setFilterStatus] = useState('pendiente')
  const [filterCompany, setFilterCompany] = useState('')

  const filtered = leads.filter(l =>
    (filterStatus === '' || l.status === filterStatus) &&
    (filterCompany === '' || l.target_company === filterCompany)
  )

  const pendientes = leads.filter(l => l.status === 'pendiente').length

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        {['', 'pendiente', 'en_revision', 'convertido', 'descartado'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
            style={filterStatus === s
              ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' }
              : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            {s === '' ? `Todos (${leads.length})` : STATUS_STYLES[s].label}
            {s === 'pendiente' && pendientes > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{pendientes}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['', 'transccl', 'tks', 'trackingccl'].map(c => (
            <button key={c} onClick={() => setFilterCompany(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={filterCompany === c
                ? { background: COMPANY_COLORS[c] ?? '#374151', color: 'white', borderColor: COMPANY_COLORS[c] ?? '#374151' }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
              }
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
