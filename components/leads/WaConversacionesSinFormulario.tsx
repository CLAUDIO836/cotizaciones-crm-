'use client'

import { useState } from 'react'
import { Phone, MapPin, Users, Calendar, Clock, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { WaSolicitud } from '@/lib/api'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function WaConvCard({ conv }: { conv: WaSolicitud }) {
  const [expanded, setExpanded] = useState(false)

  const hasData = conv.service_origin || conv.service_destination || conv.service_date || conv.service_passengers
  const phone = conv.contact_phone || conv.phone

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="h-1" style={{ background: '#25D366' }} />
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-1"
              style={{ background: '#25D366' }}>
              <MessageCircle className="w-2.5 h-2.5" />WhatsApp
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
              Sin formulario
            </span>
            {conv.client_type && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                {conv.client_type === 'empresa' ? 'Empresa' : conv.client_type === 'natural' ? 'Persona Natural' : conv.client_type}
              </span>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {conv.last_msg_at ? formatDate(conv.last_msg_at) : formatDate(conv.created_at)}
            </p>
            {conv.assigned_name && (
              <p className="text-xs text-gray-500 mt-0.5">→ {conv.assigned_name}</p>
            )}
          </div>
        </div>

        {/* Nombre + teléfono */}
        <div>
          <p className="font-bold text-gray-900 text-base leading-tight">
            {conv.contact_name || conv.phone}
          </p>
          {conv.contact_name && (
            <a href={`tel:${phone}`}
              className="flex items-center gap-1 text-sm text-green-700 hover:underline mt-0.5">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{phone}
            </a>
          )}
        </div>

        {/* Datos bot (si existen) */}
        {hasData ? (
          <div className="rounded-lg border p-3 space-y-2 text-sm"
            style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            {(conv.service_origin || conv.service_destination) && (
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                <span>
                  <span className="font-medium">{conv.service_origin || '—'}</span>
                  {conv.service_destination && (
                    <> → <span className="font-medium">{conv.service_destination}</span></>
                  )}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
              {conv.service_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <strong>{formatShortDate(conv.service_date)}</strong>
                </span>
              )}
              {conv.service_hour && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <strong>{conv.service_hour.slice(0, 5)}</strong>
                </span>
              )}
              {conv.service_passengers && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <strong>{conv.service_passengers}</strong> pasajeros
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Sin datos de servicio — el bot no recopiló información aún.
          </p>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-3">
          <a
            href={`/bandeja?exec=todos&conv=${conv.id}`}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: '#25D366' }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Abrir conversación
          </a>
          {conv.contact_phone || conv.phone ? (
            <a href={`tel:${conv.contact_phone || conv.phone}`}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors text-gray-600">
              <Phone className="w-3.5 h-3.5" />Llamar
            </a>
          ) : null}
          {conv.service_type && (
            <span className="text-xs text-gray-400">
              {conv.service_type === 'viaje_especial' ? 'Viaje especial'
                : conv.service_type === 'traslado_diario' ? 'Traslado diario'
                : conv.service_type === 'traslado_educativo' ? 'Traslado educativo'
                : conv.service_type}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WaConversacionesSinFormulario({ convs }: { convs: WaSolicitud[] }) {
  const [collapsed, setCollapsed] = useState(false)

  if (convs.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} />
          Conversaciones WA sin formulario
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white ml-1"
            style={{ background: '#25D366' }}>
            {convs.length}
          </span>
        </span>
        <div className="flex-1 border-t border-dashed" style={{ borderColor: '#d1d5db' }} />
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <div className="space-y-3">
          {convs.map(conv => (
            <WaConvCard key={conv.id} conv={conv} />
          ))}
        </div>
      )}
    </div>
  )
}
