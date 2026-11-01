'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserSession } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage  = 'nuevo' | 'cotizando' | 'ganado' | 'perdido'
type Source = 'whatsapp' | 'facebook' | 'instagram' | 'google' | 'referido' | 'otro'

interface Conversation {
  id: string
  phone: string
  contact_name: string | null
  assigned_to: string | null
  assigned_name: string | null
  bot_active: boolean
  stage: Stage
  source: Source
  last_msg_at: string | null
  last_message: string | null
}

const SOURCES: { id: Source; label: string; icon: string }[] = [
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { id: 'facebook',  label: 'Facebook',  icon: '📘' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'google',    label: 'Google',    icon: '🔍' },
  { id: 'referido',  label: 'Referido',  icon: '🤝' },
  { id: 'otro',      label: 'Otro',      icon: '📌' },
]
const sourceMap = Object.fromEntries(SOURCES.map(s => [s.id, s]))

interface Message {
  id: string
  direction: 'in' | 'out'
  content: string
  msg_type: string
  status: string
  created_at: string
}

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES: { id: Stage; label: string; color: string; bg: string; dot: string }[] = [
  { id: 'nuevo',      label: 'Nuevo',              color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  { id: 'cotizando',  label: 'Preparando cotiz.',  color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
  { id: 'ganado',     label: 'Ganado',             color: '#166534', bg: '#f0fdf4', dot: '#22c55e' },
  { id: 'perdido',    label: 'Perdido',            color: '#991b1b', bg: '#fef2f2', dot: '#ef4444' },
]

const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]))

// ── Helpers ───────────────────────────────────────────────────────────────────
function isBusinessHours(): boolean {
  const now = new Date()
  const chile = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const day = chile.getUTCDay()
  const mins = chile.getUTCHours() * 60 + chile.getUTCMinutes()
  return day >= 1 && day <= 5 && mins >= 510 && mins < 1080
}

function semaphoreColor(lastMsgAt: string | null): 'green' | 'yellow' | 'red' | 'gray' {
  if (!lastMsgAt || !isBusinessHours()) return 'gray'
  const diff = (Date.now() - new Date(lastMsgAt).getTime()) / 60000
  if (diff < 15) return 'green'
  if (diff < 30) return 'yellow'
  return 'red'
}

function fmtTime(dt: string | null): string {
  if (!dt) return ''
  const d = new Date(dt)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function fmtFull(dt: string): string {
  return new Date(dt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function SemDot({ color }: { color: ReturnType<typeof semaphoreColor> }) {
  const map = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', gray: '#d1d5db' }
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: map[color], flexShrink: 0 }} />
}

function StagePill({ stage }: { stage: Stage | null | undefined }) {
  const s = stageMap[stage as Stage] ?? stageMap['nuevo']
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Bandeja({ user }: { user: UserSession }) {
  const isAdmin = user.role === 'admin'
  const router  = useRouter()

  const [view, setView]           = useState<'list' | 'kanban'>('list')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [agents, setAgents]       = useState<{ id: string; name: string }[]>([])

  const [allAgents, setAllAgents]  = useState<{ id: string; name: string }[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const lastSeenAt = useRef<Record<string, string>>({})  // convId → last_msg_at
  const notifPerm  = useRef<NotificationPermission>('default')

  // Pedir permiso de notificaciones al montar
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    notifPerm.current = Notification.permission
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { notifPerm.current = p })
    }
  }, [])

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; name: string; active: number }[]) =>
        setAllAgents(rows.filter(r => r.active).map(r => ({ id: r.id, name: r.name })))
      )
      .catch(() => {})
  }, [])

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterAgent) params.set('assigned_to', filterAgent)
    if (filterStage) params.set('stage', filterStage)
    try {
      const res = await fetch(`/api/whatsapp/cloud/list?${params}`)
      if (!res.ok) return
      const data: Conversation[] = await res.json()

      // Detectar mensajes nuevos y notificar
      if (notifPerm.current === 'granted' && Object.keys(lastSeenAt.current).length > 0) {
        for (const conv of data) {
          const prev = lastSeenAt.current[conv.id]
          const isNew = !prev                                          // conversación nueva
          const hasNewMsg = prev && conv.last_msg_at && conv.last_msg_at > prev  // mensaje nuevo
          if ((isNew || hasNewMsg) && conv.id !== activeId) {
            const name = conv.contact_name || `+${conv.phone}`
            const notif = new Notification(`💬 ${name}`, {
              body: conv.last_message || 'Nuevo mensaje',
              icon: '/favicon.ico',
              tag:  conv.id,
            })
            notif.onclick = () => { window.focus(); notif.close() }
          }
        }
      }
      // Actualizar registro de timestamps
      for (const conv of data) {
        if (conv.last_msg_at) lastSeenAt.current[conv.id] = conv.last_msg_at
      }

      setConversations(data)
      if (activeId) {
        const updated = data.find(c => c.id === activeId)
        if (updated) setActiveConv(updated)
      }
      // Extraer agentes únicos para el filtro
      const seen = new Set<string>()
      const list: { id: string; name: string }[] = []
      for (const c of data) {
        if (c.assigned_to && !seen.has(c.assigned_to)) {
          seen.add(c.assigned_to)
          list.push({ id: c.assigned_to, name: c.assigned_name ?? c.assigned_to })
        }
      }
      setAgents(list)
    } catch { /* ignore */ }
  }, [activeId, filterAgent, filterStage])

  useEffect(() => {
    loadConversations()
    const iv = setInterval(loadConversations, 10000)
    return () => clearInterval(iv)
  }, [loadConversations])

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/whatsapp/cloud/messages?conv_id=${convId}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
      setActiveConv(data.conversation ?? null)
    } catch { /* ignore */ } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    const iv = setInterval(() => loadMessages(activeId), 5000)
    return () => clearInterval(iv)
  }, [activeId, loadMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function selectConv(conv: Conversation) {
    setActiveId(conv.id)
    setActiveConv(conv)
    setMessages([])
  }

  async function toggleBot(botActive: boolean) {
    if (!activeId) return
    await fetch('/api/whatsapp/cloud/take', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: activeId, bot_active: botActive }),
    })
    await loadConversations()
    await loadMessages(activeId)
  }

  async function changeStage(stage: Stage) {
    if (!activeId) return
    await fetch('/api/whatsapp/cloud/stage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: activeId, stage }),
    })
    setActiveConv(prev => prev ? { ...prev, stage } : prev)
    await loadConversations()
  }

  async function changeSource(source: Source) {
    if (!activeId) return
    await fetch('/api/whatsapp/cloud/source', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: activeId, source }),
    })
    setActiveConv(prev => prev ? { ...prev, source } : prev)
    await loadConversations()
  }

  async function assignConv(assignedTo: string | null) {
    if (!activeId) return
    await fetch('/api/whatsapp/cloud/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: activeId, assigned_to: assignedTo }),
    })
    const agent = allAgents.find(a => a.id === assignedTo)
    setActiveConv(prev => prev ? {
      ...prev,
      assigned_to: assignedTo,
      assigned_name: agent?.name ?? null,
    } : prev)
    await loadConversations()
  }

  async function sendMessage() {
    if (!activeConv || !text.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/whatsapp/cloud/take', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: activeId, bot_active: false }),
      })
      const res = await fetch('/api/whatsapp/cloud/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activeConv.phone, text: text.trim() }),
      })
      if (res.ok) {
        setText('')
        if (activeId) await loadMessages(activeId)
        await loadConversations()
      }
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

  // ── Groups for list view ──────────────────────────────────────────────────
  const unassigned = conversations.filter(c => !c.assigned_to)
  const mine       = conversations.filter(c => c.assigned_to === user.id)
  const others     = isAdmin ? conversations.filter(c => c.assigned_to && c.assigned_to !== user.id) : []

  const sColor = activeConv ? semaphoreColor(activeConv.last_msg_at) : 'gray'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>Bandeja WhatsApp</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('list')}   style={viewBtn(view === 'list')}>☰</button>
              <button onClick={() => setView('kanban')} style={viewBtn(view === 'kanban')}>⊞</button>
            </div>
          </div>
          <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 12 }}>{conversations.length} conversaciones</p>

          {/* Filtros */}
          {isAdmin && (
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todos los agentes</option>
              <option value="none">Sin asignar</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            style={{ ...selectStyle, marginTop: 4 }}
          >
            <option value="">Todas las etapas</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* List or Kanban */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'list' ? (
            <>
              <ConvSection title="Sin asignar" items={unassigned} activeId={activeId} onSelect={selectConv} userId={user.id} />
              <ConvSection title="Mis chats"   items={mine}       activeId={activeId} onSelect={selectConv} userId={user.id} />
              {isAdmin && <ConvSection title="Otros agentes" items={others} activeId={activeId} onSelect={selectConv} userId={user.id} />}
            </>
          ) : (
            <KanbanPanel conversations={conversations} activeId={activeId} onSelect={selectConv} />
          )}
        </div>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Selecciona una conversación
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <SemDot color={sColor} />
                    <span style={{ fontWeight: 700, color: '#111' }}>{activeConv.contact_name || activeConv.phone}</span>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>+{activeConv.phone}</span>
                    <StagePill stage={activeConv.stage} />
                    {/* Canal de origen */}
                    {(() => {
                      const src = sourceMap[activeConv.source ?? 'whatsapp'] ?? sourceMap['whatsapp']
                      return (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>
                          {src.icon} {src.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>Ejecutivo:</span>
                    <select
                      value={activeConv.assigned_to ?? ''}
                      onChange={e => assignConv(e.target.value || null)}
                      style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: '#374151', cursor: 'pointer' }}
                    >
                      <option value="">Sin asignar</option>
                      {allAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>·</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{activeConv.bot_active ? '🤖 Bot activo' : '👤 Humano'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {/* Selector de canal */}
                  <select
                    value={activeConv.source ?? 'whatsapp'}
                    onChange={e => changeSource(e.target.value as Source)}
                    style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}
                  >
                    {SOURCES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>

                  {/* Selector de etapa */}
                  <select
                    value={activeConv.stage ?? 'nuevo'}
                    onChange={e => changeStage(e.target.value as Stage)}
                    style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}
                  >
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>

                  {activeConv.bot_active && (
                    <button onClick={() => toggleBot(false)} style={btnStyle('#2563eb')}>Tomar chat</button>
                  )}
                  {!activeConv.bot_active && (
                    <button onClick={() => toggleBot(true)} style={btnStyle('#6b7280')}>Devolver al bot</button>
                  )}
                  <button
                    onClick={() => {
                      const p = new URLSearchParams({ phone: activeConv.phone })
                      if (activeConv.contact_name) p.set('name', activeConv.contact_name)
                      if (activeConv.id) p.set('conv_id', activeConv.id)
                      router.push(`/cotizaciones/nueva?${p}`)
                    }}
                    style={btnStyle('#1B8A4B')}
                  >
                    Cotizar
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>Cargando...</div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                    background: msg.direction === 'out' ? '#2563eb' : '#fff',
                    color: msg.direction === 'out' ? '#fff' : '#111',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    borderBottomRightRadius: msg.direction === 'out' ? 2 : 12,
                    borderBottomLeftRadius:  msg.direction === 'in'  ? 2 : 12,
                  }}>
                    <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: msg.direction === 'out' ? 'right' : 'left' }}>
                      {fmtFull(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
              {activeConv.bot_active ? (
                <div style={{ flex: 1, padding: '10px 14px', background: '#f3f4f6', borderRadius: 8, color: '#9ca3af', fontSize: 13 }}>
                  Bot activo — haz clic en &ldquo;Tomar chat&rdquo; para escribir
                </div>
              ) : (
                <>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, resize: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button onClick={sendMessage} disabled={sending || !text.trim()} style={btnStyle('#2563eb', sending || !text.trim())}>
                    {sending ? '...' : 'Enviar'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────
function KanbanPanel({ conversations, activeId, onSelect }: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (c: Conversation) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {STAGES.map(stage => {
        const items = conversations.filter(c => (c.stage ?? 'nuevo') === stage.id)
        return (
          <div key={stage.id}>
            <div style={{
              padding: '8px 16px 4px',
              display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: `2px solid ${stage.dot}`,
              background: stage.bg,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.dot, display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: 11, color: stage.color, opacity: 0.7, marginLeft: 'auto' }}>{items.length}</span>
            </div>
            {items.length === 0 && (
              <div style={{ padding: '8px 16px', fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>—</div>
            )}
            {items.map(c => {
              const color = semaphoreColor(c.last_msg_at)
              const active = c.id === activeId
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c)}
                  style={{
                    padding: '9px 16px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                    background: active ? '#eff6ff' : 'transparent',
                    borderLeft: active ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                >
                  <div style={{ marginTop: 5 }}><SemDot color={color} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contact_name || `+${c.phone}`}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtTime(c.last_msg_at)}</span>
                    </div>
                    {c.assigned_name && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>→ {c.assigned_name}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── List section ──────────────────────────────────────────────────────────────
function ConvSection({ title, items, activeId, onSelect, userId }: {
  title: string; items: Conversation[]; activeId: string | null
  onSelect: (c: Conversation) => void; userId: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title} ({items.length})
      </div>
      {items.map(c => {
        const color  = semaphoreColor(c.last_msg_at)
        const active = c.id === activeId
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              padding: '9px 16px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
              background: active ? '#eff6ff' : 'transparent',
              borderLeft: active ? '3px solid #2563eb' : '3px solid transparent',
            }}
          >
            <div style={{ marginTop: 5 }}><SemDot color={color} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, color: '#111', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.contact_name || `+${c.phone}`}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtTime(c.last_msg_at)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.last_message || '—'}
                </div>
                <StagePill stage={c.stage ?? 'nuevo'} />
              </div>
              {c.assigned_to && c.assigned_to !== userId && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>→ {c.assigned_name ?? 'Agente'}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    padding: '7px 14px', background: disabled ? '#e5e7eb' : bg, color: disabled ? '#9ca3af' : '#fff',
    border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
  }
}

function viewBtn(active: boolean): React.CSSProperties {
  return {
    padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer',
    background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#6b7280',
    fontSize: 14, lineHeight: 1,
  }
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
  fontSize: 12, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer',
}
