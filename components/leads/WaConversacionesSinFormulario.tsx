'use client'

import { useState, useEffect } from 'react'
import { Phone, MapPin, Users, Calendar, Clock, MessageCircle, Timer, UserCheck, ArrowRightCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { WaSolicitud } from '@/lib/api'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Cronómetro en vivo con lógica de ventana 24h WhatsApp */
function WaCronometro({ desde }: { desde: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const base = new Date(desde).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [desde])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  // Colores por ventana: <12h verde, 12-20h amarillo, 20-24h naranja, >24h rojo (ventana cerrada)
  const hours = elapsed / 3600
  const { bg, color, label } = hours < 12
    ? { bg: '#f0fdf4', color: '#166534', label: 'En ventana' }
    : hours < 20
    ? { bg: '#fefce8', color: '#854d0e', label: 'Próximo a vencer' }
    : hours < 24
    ? { bg: '#fff7ed', color: '#c2410c', label: 'Vence pronto' }
    : { bg: '#fef2f2', color: '#991b1b', label: 'Ventana cerrada' }

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full"
      style={{ background: bg, color }}
      title={`Última actividad: ${formatDate(desde)}`}
    >
      <Timer className="w-3 h-3 flex-shrink-0" />
      {h > 0 ? `${h}h ` : ''}{pad(m)}m {pad(s)}s
      <span className="font-sans font-medium text-[10px] opacity-80">· {label}</span>
    </span>
  )
}

function formatShortDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

/** Advertencia roja cuando la ventana de 24h está cerrada */
function VentanaCerradaWarning({ desde, convId, phone }: { desde: string; convId: string; phone: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const base = new Date(desde).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000))
    tick()
    const id = setInterval(tick, 10000) // actualizar cada 10s (suficiente para esta alerta)
    return () => clearInterval(id)
  }, [desde])

  const hours = elapsed / 3600
  if (hours < 24) return null

  const extraHours = Math.floor(hours - 24)
  const extraMins  = Math.floor(((hours - 24) % 1) * 60)

  return (
    <div className="rounded-lg border p-3 space-y-2"
      style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">🔴</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: '#991b1b' }}>
            Ventana WhatsApp cerrada
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>
            Hace {extraHours > 0 ? `${extraHours}h ` : ''}{extraMins}m que venció la ventana de 24h.
            Para retomar contacto debes enviar la plantilla <strong>ccl_saludo_reactivacion</strong>.
          </p>
        </div>
      </div>
      <a
        href={`/bandeja?exec=todos&conv=${convId}`}
        className="flex items-center justify-center gap-1.5 w-full text-xs font-bold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
        style={{ background: '#dc2626' }}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Enviar mensaje de reactivación
      </a>
    </div>
  )
}

async function promoteToLead(convId: string): Promise<{ lead_id?: string; error?: string }> {
  try {
    const r = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'wa_promote_to_lead', conv_id: convId }),
    })
    return r.ok ? r.json() : { error: 'Error del servidor' }
  } catch { return { error: 'Error de red' } }
}

function WaConvCard({ conv, onPromoted }: { conv: WaSolicitud; onPromoted: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState('')
  const router = useRouter()

  const hasData = conv.service_origin || conv.service_destination || conv.service_date || conv.service_passengers
  const phone = conv.contact_phone || conv.phone

  async function handlePromote() {
    setPromoting(true)
    setPromoteError('')
    const res = await promoteToLead(conv.id)
    if (res.lead_id) {
      onPromoted(conv.id)
      router.refresh()
    } else {
      setPromoteError(res.error || 'Error desconocido')
      setPromoting(false)
    }
  }

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
            {conv.assigned_name && (
              <p className="text-xs text-gray-500 mb-0.5">→ {conv.assigned_name}</p>
            )}
          </div>
        </div>

        {/* Cronómetro ventana 24h */}
        <WaCronometro desde={conv.last_msg_at || conv.created_at} />

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

        {/* Advertencia ventana cerrada */}
        <VentanaCerradaWarning desde={conv.last_msg_at || conv.created_at} convId={conv.id} phone={conv.contact_phone || conv.phone} />

        {/* Acciones */}
        <div className="flex items-center gap-3 flex-wrap">
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
          <button
            onClick={handlePromote}
            disabled={promoting}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
            style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}
            title="Crear solicitud formal en el pipeline para asignar ejecutivo"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" />
            {promoting ? 'Moviendo…' : 'Mover al pipeline'}
          </button>
        </div>

        {promoteError && (
          <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#dc2626' }}>
            <X className="w-3 h-3" />{promoteError}
          </p>
        )}
      </div>
    </div>
  )
}

type WaSubTab = 'espera' | 'pipeline' | 'todos'

export default function WaConversacionesSinFormulario({ convs }: { convs: WaSolicitud[] }) {
  const [filterEjecutivo, setFilterEjecutivo] = useState('')
  const [subTab, setSubTab] = useState<WaSubTab>('espera')
  const [showTodos, setShowTodos] = useState(false)
  const [promotedIds, setPromotedIds] = useState<Map<string, string>>(new Map()) // id → lead_id ficticio para mover a pipeline tab

  function handlePromoted(id: string) {
    setPromotedIds(prev => new Map([...prev, [id, 'promoted']]))
  }

  // Enriquecer convs con promociones locales
  const enriched = convs.map(c => ({
    ...c,
    has_lead: (Number(c.has_lead) === 1 || promotedIds.has(c.id)) ? 1 : 0,
  } as WaSolicitud))

  const sinLead = enriched.filter(c => Number(c.has_lead) !== 1)
  const conLead = enriched.filter(c => Number(c.has_lead) === 1)

  const baseList = subTab === 'espera' ? sinLead : subTab === 'pipeline' ? conLead : enriched

  // Ejecutivos únicos en la lista actual
  const ejecutivosConConvs = Array.from(
    new Map(
      baseList.filter(c => c.assigned_name).map(c => [c.assigned_name!, c.assigned_name!])
    ).entries()
  ).map(([name]) => name).sort()
  const sinAsignarCount = baseList.filter(c => !c.assigned_name).length

  const filtered = baseList
    .filter(c => {
      if (filterEjecutivo === 'sin_asignar') return !c.assigned_name
      return filterEjecutivo === '' || c.assigned_name === filterEjecutivo
    })
    .sort((a, b) => new Date(b.last_msg_at || b.created_at).getTime() - new Date(a.last_msg_at || a.created_at).getTime())

  function SubTabBtn({ value, label, count, color }: { value: WaSubTab; label: string; count: number; color: string }) {
    const active = subTab === value
    return (
      <button
        onClick={() => { setSubTab(value); setFilterEjecutivo('') }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border"
        style={active
          ? { background: color, color: 'white', borderColor: color }
          : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }}
      >
        {label}
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none"
          style={active ? { background: 'rgba(255,255,255,0.3)', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
          {count}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <SubTabBtn value="espera" label="Espera de datos" count={sinLead.length} color="#25D366" />
        <SubTabBtn value="pipeline" label="Movidos al pipeline" count={conLead.length} color="#1e40af" />
        <button
          onClick={() => { setShowTodos(v => !v); if (!showTodos) setSubTab('todos'); else setSubTab('espera') }}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ml-auto"
          style={{ color: '#9ca3af', borderColor: '#e5e7eb', background: 'transparent' }}
        >
          Ver todo {enriched.length}
        </button>
      </div>

      {/* Filtro por ejecutivo */}
      {ejecutivosConConvs.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center pb-1">
          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />Ejecutivo:
          </span>
          <button
            onClick={() => setFilterEjecutivo('')}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors"
            style={filterEjecutivo === ''
              ? { background: '#374151', color: 'white', borderColor: '#374151' }
              : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }}
          >
            Todos <span className="ml-1 opacity-80">{baseList.length}</span>
          </button>
          {ejecutivosConConvs.map(name => {
            const count = baseList.filter(c => c.assigned_name === name).length
            const isActive = filterEjecutivo === name
            const firstName = name.split(' ')[0]
            return (
              <button key={name}
                onClick={() => setFilterEjecutivo(isActive ? '' : name)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors"
                style={isActive
                  ? { background: '#374151', color: 'white', borderColor: '#374151' }
                  : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {firstName} <span className="opacity-80">{count}</span>
              </button>
            )
          })}
          {sinAsignarCount > 0 && (
            <button
              onClick={() => setFilterEjecutivo(filterEjecutivo === 'sin_asignar' ? '' : 'sin_asignar')}
              className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors"
              style={filterEjecutivo === 'sin_asignar'
                ? { background: '#6b7280', color: 'white', borderColor: '#6b7280' }
                : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' }}
            >
              Sin asignar <span className="opacity-80">{sinAsignarCount}</span>
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">
            {subTab === 'espera' ? 'Sin conversaciones en espera de datos' :
             subTab === 'pipeline' ? 'Ninguna conversación movida al pipeline aún' :
             'Sin conversaciones WA'}
          </p>
        </div>
      ) : (
        filtered.map(conv => (
          <WaConvCard key={conv.id} conv={conv} onPromoted={handlePromoted} />
        ))
      )}
    </div>
  )
}
