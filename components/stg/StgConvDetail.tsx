'use client'
import { useState } from 'react'
import { UserSession } from '@/lib/api'

interface Message {
  id: string
  direction: 'in' | 'out'
  content: string
  msg_type: string
  status: string
  sender_type: string | null
  created_at: string
}

interface Conversation {
  id: string
  phone: string
  bot_active: boolean | number
  stage: string
  source: string
  contact_name: string | null
  contact_rut: string | null
  contact_email: string | null
  company_name: string | null
  client_type: string | null
  service_origin: string | null
  service_destination: string | null
  service_date: string | null
  service_hour: string | null
  service_hour_return: string | null
  service_passengers: number | null
  service_type: string | null
  service_vehicle: string | null
  service_km: number | null
  assigned_to: string | null
  assigned_name: string | null
  handoff_requested_at: string | null
  wa_draft_quote_id: string | null
  notes: string | null
  last_msg_at: string | null
  last_customer_msg_at: string | null
  created_at: string
}

interface Quote {
  id: string
  quote_number?: string
  total_bd?: string
  desde?: string
  hasta?: string
  distancia_km?: number
  fecha_salida?: string
  hora_salida?: string
  vehicle_type?: string
  pasajeros?: string
  status?: string
}

interface Props {
  user: UserSession
  data: { conversation: Conversation; messages: Message[]; quote: Quote | null; viewer: Record<string, unknown> } | null
  error: string | null
  convId: string
}

function fmt(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function MsgBubble({ msg }: { msg: Message }) {
  const isBot   = msg.direction === 'out' && msg.sender_type === 'bot'
  const isHuman = msg.direction === 'out' && msg.sender_type === 'human'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.direction === 'out' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      {msg.direction === 'out' && (
        <span style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, marginRight: 4 }}>
          {isBot ? '🤖 Bot' : isHuman ? '👤 Ejecutiva' : '⬆'}
        </span>
      )}
      <div style={{
        maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
        background: msg.direction === 'out' ? (isBot ? '#7c3aed' : '#2563eb') : '#fff',
        color: msg.direction === 'out' ? '#fff' : '#111',
        boxShadow: '0 1px 2px rgba(0,0,0,.1)',
        borderBottomRightRadius: msg.direction === 'out' ? 2 : 12,
        borderBottomLeftRadius: msg.direction === 'in' ? 2 : 12,
        border: msg.direction === 'in' ? '1px solid #e5e7eb' : 'none',
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{msg.content}</div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: .7, textAlign: msg.direction === 'out' ? 'right' : 'left' }}>
          {new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

export default function StgConvDetail({ user, data, error, convId }: Props) {
  const [tab, setTab] = useState<'historial' | 'ficha'>('historial')

  if (error) {
    const is403 = error.includes('permiso') || error.includes('403')
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 440, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{is403 ? '🔒' : '⚠️'}</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111' }}>
            {is403 ? 'Acceso no autorizado' : 'Error al cargar'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>{error}</p>
          <a href="/bandeja" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Ir a la bandeja
          </a>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        Cargando...
      </div>
    )
  }

  const { conversation: c, messages, quote } = data
  const botOff = !c.bot_active || c.bot_active === 0
  const hasHandoff = !!c.handoff_requested_at

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 720, margin: '0 auto' }}>
          <a href="/bandeja" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 18, lineHeight: 1 }}>←</a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.contact_name || `+${c.phone}`}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>+{c.phone}</span>
              <span style={{ padding: '1px 6px', background: '#ede9fe', color: '#7c3aed', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                STG {c.stage ?? 'nuevo'}
              </span>
              {botOff && (
                <span style={{ padding: '1px 6px', background: hasHandoff ? '#fef3c7' : '#fef2f2', color: hasHandoff ? '#b45309' : '#dc2626', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                  {hasHandoff ? '👤 Ejecutiva activa' : '⏸ Bot inactivo'}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', flexShrink: 0 }}>
            {c.assigned_name ? `→ ${c.assigned_name}` : 'Sin asignar'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px' }}>

        {/* Alerta de cotización pendiente */}
        {quote && (
          <div style={{ background: '#f5f3ff', border: '2px solid #7c3aed', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 13, marginBottom: 8 }}>🤖 Sofía — Cotización pendiente de aprobación</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
              {quote.quote_number && <div><span style={{ color: '#9ca3af' }}>Nº:</span> <strong>{quote.quote_number}</strong></div>}
              {quote.total_bd && <div><span style={{ color: '#9ca3af' }}>Monto:</span> <strong style={{ color: '#1B8A4B' }}>${Number(quote.total_bd).toLocaleString('es-CL')}</strong></div>}
              {quote.desde && <div><span style={{ color: '#9ca3af' }}>Desde:</span> {quote.desde}</div>}
              {quote.hasta && <div><span style={{ color: '#9ca3af' }}>Hasta:</span> {quote.hasta}</div>}
              {quote.distancia_km && <div><span style={{ color: '#9ca3af' }}>Distancia:</span> {quote.distancia_km} km</div>}
              {quote.fecha_salida && <div><span style={{ color: '#9ca3af' }}>Fecha:</span> {quote.fecha_salida}{quote.hora_salida ? ` ${quote.hora_salida}` : ''}</div>}
              {quote.vehicle_type && <div><span style={{ color: '#9ca3af' }}>Vehículo:</span> {quote.vehicle_type}</div>}
              {quote.pasajeros && <div><span style={{ color: '#9ca3af' }}>Pasajeros:</span> {quote.pasajeros}</div>}
            </div>
            {quote.status === 'pending' && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#7c3aed' }}>Estado: pendiente de aprobación por supervisor</div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['historial', 'ficha'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: tab === t ? '#2563eb' : '#fff', color: tab === t ? '#fff' : '#6b7280',
                fontWeight: tab === t ? 600 : 400, fontSize: 13,
                boxShadow: tab === t ? 'none' : '0 1px 3px rgba(0,0,0,.08)',
              }}
            >
              {t === 'historial' ? '💬 Historial' : '📋 Ficha'}
            </button>
          ))}
        </div>

        {/* Historial */}
        {tab === 'historial' && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 10px', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Sin mensajes registrados</div>
            )}
            {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
          </div>
        )}

        {/* Ficha */}
        {tab === 'ficha' && (
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              <Field label="Nombre" value={c.contact_name} />
              <Field label="Teléfono" value={c.phone ? `+${c.phone}` : null} />
              <Field label="RUT" value={c.contact_rut} />
              <Field label="Email" value={c.contact_email} />
              <Field label="Empresa" value={c.company_name} />
              <Field label="Tipo cliente" value={c.client_type} />
              <Field label="Origen" value={c.service_origin} />
              <Field label="Destino" value={c.service_destination} />
              <Field label="Fecha servicio" value={c.service_date} />
              <Field label="Hora salida" value={c.service_hour} />
              <Field label="Hora retorno" value={c.service_hour_return} />
              <Field label="Pasajeros" value={c.service_passengers?.toString()} />
              <Field label="Tipo servicio" value={c.service_type} />
              <Field label="Vehículo" value={c.service_vehicle} />
              <Field label="Distancia km" value={c.service_km?.toString()} />
              <Field label="Etapa" value={c.stage} />
            </div>
            {c.notes && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>NOTAS INTERNAS</div>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{c.notes}</div>
              </div>
            )}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#9ca3af' }}>
              <div>Creado: {fmt(c.created_at)}</div>
              <div>Último mensaje: {fmt(c.last_msg_at)}</div>
              <div>Asignado a: {c.assigned_name ?? 'Sin asignar'}</div>
              <div style={{ marginTop: 6, fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                Vista de staging — no es producción
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, color: value ? '#111' : '#d1d5db' }}>{value || '—'}</div>
    </div>
  )
}
