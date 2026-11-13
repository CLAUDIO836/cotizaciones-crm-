'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SofiaMetrics {
  prospectos_bot: number
  formularios_completados: number
  borradores_creados: number
  aprobadas_enviadas: number
  rechazadas: number
  intervenciones_humanas: number
  ganados_sofia: number
}

interface WaConv {
  id: string
  phone: string
  contact_name: string | null
  assigned_name: string | null
  stage: string
  bot_active: boolean
  wa_draft_quote_id: string | null
  last_msg_at: string | null
  last_message: string | null
  unread_count: number
  service_origin: string | null
  service_destination: string | null
  service_date: string | null
}

type Section = 'resumen' | 'gestion' | 'aprobaciones' | 'seguimiento' | 'resultados' | 'control'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

function fmtTime(dt: string | null) {
  if (!dt) return ''
  const d = new Date(dt)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

const STAGE_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  formulario_enviado: 'Form. enviado',
  formulario_completo: 'Listo p/ cotizar',
  cotizando: 'Preparando cotiz.',
  ganado: 'Ganado',
  perdido: 'Perdido',
  cerrado: 'Cerrado',
}

const STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  nuevo:               { bg: '#f3f4f6', color: '#6b7280' },
  formulario_enviado:  { bg: '#fffbeb', color: '#b45309' },
  formulario_completo: { bg: '#ecfdf5', color: '#065f46' },
  cotizando:           { bg: '#eff6ff', color: '#1d4ed8' },
  ganado:              { bg: '#f0fdf4', color: '#166534' },
  perdido:             { bg: '#fef2f2', color: '#991b1b' },
  cerrado:             { bg: '#f9fafb', color: '#4b5563' },
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SofiaDashboard({ mode = 'production' }: { mode?: 'production' | 'staging' }) {
  const isStaging = mode === 'staging'
  const listUrl      = isStaging ? '/api/whatsapp/cloud/staging-list'      : '/api/whatsapp/cloud/list'
  const approvalsUrl = isStaging ? '/api/whatsapp/cloud/staging-approvals' : '/api/whatsapp/cloud/approvals'

  const [section, setSection] = useState<Section>('aprobaciones')
  const [metrics, setMetrics] = useState<SofiaMetrics | null>(null)
  const [convs, setConvs]     = useState<WaConv[]>([])
  const [loading, setLoading] = useState(true)
  const [webhookOk, setWebhookOk] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const promises: Promise<Response>[] = [fetch(listUrl)]
      if (!isStaging) promises.unshift(fetch('/api/whatsapp/cloud/metrics'))
      const results = await Promise.all(promises)
      if (!isStaging) {
        const [mRes, cRes] = results
        if (mRes.ok) { const d = await mRes.json(); setMetrics(d.metrics ?? null) }
        if (cRes.ok) { const d = await cRes.json(); setConvs(Array.isArray(d) ? d : []) }
      } else {
        const [cRes] = results
        if (cRes.ok) { const d = await cRes.json(); setConvs(Array.isArray(d) ? d : []) }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [isStaging, listUrl])

  // Webhook status solo en producción
  useEffect(() => {
    if (isStaging) { setWebhookOk(null); return }
    fetch('/api/whatsapp/cloud/list')
      .then(r => setWebhookOk(r.ok))
      .catch(() => setWebhookOk(false))
  }, [isStaging])

  useEffect(() => { load() }, [load])

  // Derived lists
  const pendingApproval = convs.filter(c => c.wa_draft_quote_id)
  const botActive       = convs.filter(c => c.bot_active && !['ganado','perdido','cerrado'].includes(c.stage))
  const needFollowUp    = convs.filter(c => !c.bot_active && !['ganado','perdido','cerrado'].includes(c.stage))
  const wonConvs        = convs.filter(c => c.stage === 'ganado')

  const conversion = metrics && metrics.prospectos_bot > 0
    ? Math.round((metrics.ganados_sofia / metrics.prospectos_bot) * 100)
    : 0

  const NAV: { id: Section; label: string; badge?: number }[] = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'gestion',      label: '🤖 Gestión', badge: botActive.length },
    { id: 'aprobaciones', label: '✅ Aprobaciones', badge: pendingApproval.length },
    { id: 'seguimiento',  label: '⏰ Seguimiento', badge: needFollowUp.length },
    { id: 'resultados',   label: '🏆 Resultados' },
    { id: 'control',      label: '⚙️ Control' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>

      {/* Sidebar nav */}
      <div style={{ width: 200, borderRight: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Staging banner */}
        {isStaging && (
          <div style={{ background: '#7c3aed', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 700, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            🧪 MODO STAGING — Solo base de datos de prueba
          </div>
        )}
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: isStaging ? '#f3e8ff' : '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {isStaging ? '🧪' : '🤖'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{isStaging ? 'Sofía · Pruebas' : 'Sofía'}</div>
              <div style={{ fontSize: 11, color: isStaging ? '#7c3aed' : (webhookOk === true ? '#16a34a' : webhookOk === false ? '#dc2626' : '#9ca3af'), display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStaging ? '#a78bfa' : (webhookOk === true ? '#22c55e' : webhookOk === false ? '#ef4444' : '#d1d5db'), display: 'inline-block' }} />
                {isStaging ? 'Staging aislado' : (webhookOk === true ? 'Activa' : webhookOk === false ? 'Sin conexión' : 'Verificando...')}
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 16px',
                background: section === n.id ? '#f0fdf4' : 'transparent',
                borderLeft: section === n.id ? '3px solid #1B8A4B' : '3px solid transparent',
                border: 'none', cursor: 'pointer', fontSize: 13,
                color: section === n.id ? '#166534' : '#374151',
                fontWeight: section === n.id ? 600 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              {n.label}
              {!!n.badge && n.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accesos directos</div>
          {[
            { href: '/bandeja', label: '💬 Bandeja WA' },
            { href: '/por-aprobar', label: '✅ Por aprobar' },
            { href: '/cotizaciones/nueva', label: '📋 Cotizador' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ display: 'block', fontSize: 12, color: '#2563eb', textDecoration: 'none', padding: '3px 0', fontWeight: 500 }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {loading ? (
          <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>Cargando datos de Sofía...</div>
        ) : (
          <div style={{ padding: '24px 28px', maxWidth: 900 }}>

            {/* ── RESUMEN ── */}
            {section === 'resumen' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Resumen ejecutivo</h2>
                {metrics ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
                      <KpiCard label="Prospectos" value={metrics.prospectos_bot} color="#6b7280" />
                      <KpiCard label="Formularios" value={metrics.formularios_completados} color="#b45309" />
                      <KpiCard label="Cotizaciones generadas" value={metrics.borradores_creados} color="#1d4ed8" />
                      <KpiCard label="Pend. aprobación" value={pendingApproval.length} color="#d97706" alert={pendingApproval.length > 0} />
                      <KpiCard label="Enviadas" value={metrics.aprobadas_enviadas} color="#1B8A4B" />
                      <KpiCard label="Intervenciones" value={metrics.intervenciones_humanas} color="#7c3aed" />
                      <KpiCard label="Ventas Sofía" value={metrics.ganados_sofia} color="#166534" />
                      <KpiCard label="Conversión" value={`${conversion}%`} color="#065f46" />
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 12 }}>Estado del pipeline WhatsApp</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {Object.entries(STAGE_LABEL).map(([stage, label]) => {
                          const count = convs.filter(c => c.stage === stage).length
                          if (!count) return null
                          const style = STAGE_COLOR[stage] ?? { bg: '#f9fafb', color: '#6b7280' }
                          return (
                            <div key={stage} style={{ padding: '6px 12px', borderRadius: 8, background: style.bg, color: style.color, fontSize: 12, fontWeight: 600 }}>
                              {label} <span style={{ fontWeight: 700 }}>{count}</span>
                            </div>
                          )
                        })}
                        {convs.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin conversaciones activas</div>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#9ca3af' }}>Sin métricas disponibles (tabla wa_quote_approvals puede estar vacía)</div>
                )}
              </>
            )}

            {/* ── GESTIÓN ── */}
            {section === 'gestion' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Gestión comercial activa</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  Oportunidades que Sofía está gestionando (bot activo, no cerradas).
                </p>
                {botActive.length === 0 ? (
                  <EmptyState icon="🤖" msg="Sin oportunidades activas con Sofía en este momento" />
                ) : (
                  <ConvTable convs={botActive} showApproval approvalsUrl={approvalsUrl} />
                )}
              </>
            )}

            {/* ── APROBACIONES ── */}
            {section === 'aprobaciones' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Cotizaciones pendientes de aprobación</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  Sofía preparó estas cotizaciones. Requieren aprobación de una ejecutiva antes de enviarse al cliente.{' '}
                  <Link href="/por-aprobar" style={{ color: '#2563eb', fontWeight: 600 }}>Ir al módulo Por Aprobar →</Link>
                </p>
                {isStaging && (
                  <div style={{ background: '#faf5ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6d28d9' }}>
                    <strong>🧪 Entorno de pruebas</strong> — Los botones Aprobar y Rechazar operan exclusivamente sobre la base de datos staging.
                    Ningún mensaje será enviado por WhatsApp. La decisión queda registrada con tu usuario y la fecha exacta.
                  </div>
                )}
                {pendingApproval.length === 0 ? (
                  <EmptyState icon="✅" msg="Sin cotizaciones pendientes de aprobación" />
                ) : (
                  <ConvTable convs={pendingApproval} showApproval onDecide={load} approvalsUrl={approvalsUrl} />
                )}
              </>
            )}

            {/* ── SEGUIMIENTO ── */}
            {section === 'seguimiento' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Seguimiento y atención humana</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  Clientes con bot inactivo que requieren respuesta o seguimiento de una ejecutiva.
                </p>
                {needFollowUp.length === 0 ? (
                  <EmptyState icon="⏰" msg="Sin conversaciones pendientes de seguimiento" />
                ) : (
                  <ConvTable convs={needFollowUp} />
                )}
              </>
            )}

            {/* ── RESULTADOS ── */}
            {section === 'resultados' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Resultados</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  Ventas originadas o gestionadas por Sofía este mes.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <KpiCard label="Ventas Sofía" value={metrics?.ganados_sofia ?? 0} color="#166534" />
                  <KpiCard label="Cotiz. enviadas" value={metrics?.aprobadas_enviadas ?? 0} color="#1B8A4B" />
                  <KpiCard label="Conversión" value={`${conversion}%`} color="#065f46" />
                </div>
                {wonConvs.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 10 }}>Clientes ganados</div>
                    <ConvTable convs={wonConvs} />
                  </>
                )}
                {wonConvs.length === 0 && (
                  <EmptyState icon="🏆" msg="Sin ventas registradas aún este mes" />
                )}
              </>
            )}

            {/* ── CONTROL ── */}
            {section === 'control' && (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111' }}>Control del agente</h2>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 12 }}>Estado de Sofía WhatsApp</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: webhookOk === true ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                      {webhookOk === true ? 'Webhook activo — Sofía está respondiendo mensajes' : 'No se pudo verificar el estado del webhook'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                    <div>• Sofía opera vía webhook de WhatsApp Cloud API</div>
                    <div>• El round-robin asigna automáticamente: Jhocisbell, Javiera, Danae</div>
                    <div>• Toda cotización requiere aprobación humana antes de enviarse</div>
                    <div>• Las intervenciones manuales se registran en el historial</div>
                  </div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#92400e', marginBottom: 6 }}>Nota de arquitectura</div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    Este módulo supervisa a Sofía WA (WhatsApp Cloud). El botón &ldquo;Activar IA&rdquo; del sistema anterior
                    controla un agente distinto sobre el pipeline CRM clásico (B2B). Ambos sistemas coexisten
                    con tablas separadas. Para activar/pausar Sofía WA, se requiere acción en el servidor.
                    Contactar a administración técnica.
                  </div>
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, alert }: { label: string; value: number | string; color: string; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? `${color}11` : '#fff', border: `1px solid ${alert ? color + '55' : '#e5e7eb'}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: alert ? color : '#111', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{msg}</div>
    </div>
  )
}

function ConvTable({ convs, showApproval, onDecide, approvalsUrl = '/api/whatsapp/cloud/approvals' }: {
  convs: WaConv[]
  showApproval?: boolean
  onDecide?: () => void
  approvalsUrl?: string
}) {
  const [deciding, setDeciding] = useState<Record<string, 'approving' | 'rejecting' | 'done' | 'error'>>({})

  async function decide(convId: string, decision: 'approved' | 'rejected') {
    setDeciding(prev => ({ ...prev, [convId]: decision === 'approved' ? 'approving' : 'rejecting' }))
    try {
      const res = await fetch(approvalsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: convId, decision }),
      })
      const d = await res.json()
      if (!res.ok) {
        alert(d.error ?? 'Error al procesar la decisión')
        setDeciding(prev => ({ ...prev, [convId]: 'error' }))
        return
      }
      setDeciding(prev => ({ ...prev, [convId]: 'done' }))
      onDecide?.()
    } catch {
      setDeciding(prev => ({ ...prev, [convId]: 'error' }))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {convs.map(c => {
        const stageStyle = STAGE_COLOR[c.stage] ?? STAGE_COLOR['nuevo']
        const state = deciding[c.id]
        const hasDraft = showApproval && c.wa_draft_quote_id
        return (
          <div key={c.id} style={{
            background: '#fff', border: `1px solid ${hasDraft ? '#fcd34d' : '#e5e7eb'}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <Link href={`/bandeja?conv=${c.id}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>
                      {c.contact_name || `+${c.phone}`}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>+{c.phone}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: stageStyle.bg, color: stageStyle.color }}>
                      {STAGE_LABEL[c.stage] ?? c.stage}
                    </span>
                    {c.bot_active && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>🤖 Bot activo</span>}
                    {hasDraft && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 6px' }}>
                        ⏳ Pend. aprobación
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {c.service_origin && <span>📍 {c.service_origin}</span>}
                    {c.service_destination && <span>→ {c.service_destination}</span>}
                    {c.service_date && <span>📅 {c.service_date}</span>}
                  </div>
                  {c.last_message && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last_message}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {c.assigned_name && <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{c.assigned_name.split(' ')[0]}</div>}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtTime(c.last_msg_at)}</div>
                  {c.unread_count > 0 && (
                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 700, background: '#eab308', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Botones de aprobación — fuera del Link para evitar navegación accidental */}
            {hasDraft && state !== 'done' && (
              <div style={{
                borderTop: '1px solid #fde68a', background: '#fffbeb',
                padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: '#92400e', flex: 1 }}>
                  Cotización lista — revisa antes de aprobar
                </span>
                <button
                  onClick={() => decide(c.id, 'rejected')}
                  disabled={!!state}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: state ? 'default' : 'pointer',
                    border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', opacity: state ? 0.5 : 1,
                  }}
                >
                  {state === 'rejecting' ? 'Rechazando…' : '✕ Rechazar'}
                </button>
                <button
                  onClick={() => decide(c.id, 'approved')}
                  disabled={!!state}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: state ? 'default' : 'pointer',
                    border: 'none', background: '#16a34a', color: '#fff', opacity: state ? 0.5 : 1,
                  }}
                >
                  {state === 'approving' ? 'Aprobando…' : '✓ Aprobar'}
                </button>
              </div>
            )}
            {hasDraft && state === 'done' && (
              <div style={{ borderTop: '1px solid #bbf7d0', background: '#f0fdf4', padding: '8px 16px', fontSize: 11, color: '#166534', fontWeight: 600 }}>
                ✓ Decisión registrada — recargando…
              </div>
            )}
            {hasDraft && state === 'error' && (
              <div style={{ borderTop: '1px solid #fecaca', background: '#fef2f2', padding: '8px 16px', fontSize: 11, color: '#dc2626' }}>
                Error al procesar. Intenta nuevamente.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
