'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { UserSession } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Conversation {
  id: string
  phone: string
  contact_name: string | null
  assigned_to: string | null
  assigned_name: string | null
  bot_active: boolean
  last_msg_at: string | null
  last_message: string | null
}

interface Message {
  id: string
  direction: 'in' | 'out'
  content: string
  msg_type: string
  status: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isBusinessHours(): boolean {
  // Chile time = UTC-3
  const now = new Date()
  const chile = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const day = chile.getUTCDay() // 0=Sun, 6=Sat
  const h = chile.getUTCHours()
  const m = chile.getUTCMinutes()
  const mins = h * 60 + m
  return day >= 1 && day <= 5 && mins >= 8 * 60 + 30 && mins < 18 * 60
}

function semaphoreColor(lastMsgAt: string | null): 'green' | 'yellow' | 'red' | 'gray' {
  if (!lastMsgAt) return 'gray'
  if (!isBusinessHours()) return 'gray'
  const diff = (Date.now() - new Date(lastMsgAt).getTime()) / 60000
  if (diff < 15) return 'green'
  if (diff < 30) return 'yellow'
  return 'red'
}

function fmtTime(dt: string | null): string {
  if (!dt) return ''
  const d = new Date(dt)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function fmtFull(dt: string): string {
  return new Date(dt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// ── Semaphore dot ─────────────────────────────────────────────────────────────
function SemDot({ color }: { color: ReturnType<typeof semaphoreColor> }) {
  const map = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', gray: '#d1d5db' }
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: map[color], flexShrink: 0,
    }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Bandeja({ user }: { user: UserSession }) {
  const isAdmin = user.role === 'admin'
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Load conversations ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/cloud/list')
      if (!res.ok) return
      const data: Conversation[] = await res.json()
      setConversations(data)
      // Update active conv metadata
      if (activeId) {
        const updated = data.find(c => c.id === activeId)
        if (updated) setActiveConv(updated)
      }
    } catch { /* ignore */ }
  }, [activeId])

  useEffect(() => {
    loadConversations()
    const iv = setInterval(loadConversations, 10000)
    return () => clearInterval(iv)
  }, [loadConversations])

  // ── Load messages for active conv ─────────────────────────────────────────
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Select conversation ────────────────────────────────────────────────────
  function selectConv(conv: Conversation) {
    setActiveId(conv.id)
    setActiveConv(conv)
    setMessages([])
  }

  // ── Take / release chat ────────────────────────────────────────────────────
  async function toggleBot(botActive: boolean) {
    if (!activeId) return
    const res = await fetch('/api/whatsapp/cloud/take', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: activeId, bot_active: botActive }),
    })
    if (res.ok) {
      await loadConversations()
      await loadMessages(activeId)
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!activeConv || !text.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/whatsapp/cloud/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: activeId, bot_active: false }),
      })
      const res = await fetch('/api/whatsapp/cloud/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ── Split: unassigned vs mine ─────────────────────────────────────────────
  const unassigned = conversations.filter(c => !c.assigned_to)
  const mine = conversations.filter(c => c.assigned_to === user.id)
  const others = isAdmin ? conversations.filter(c => c.assigned_to && c.assigned_to !== user.id) : []

  const sColor = activeConv ? semaphoreColor(activeConv.last_msg_at) : 'gray'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>

      {/* ── Left panel: conversation list ── */}
      <div style={{
        width: 300, borderRight: '1px solid #e5e7eb', display: 'flex',
        flexDirection: 'column', background: '#fff', flexShrink: 0,
      }}>
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111' }}>
            Bandeja WhatsApp
          </h2>
          <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: 12 }}>
            {conversations.length} conversaciones
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConvSection title="Sin asignar" items={unassigned} activeId={activeId} onSelect={selectConv} userId={user.id} />
          <ConvSection title="Mis chats" items={mine} activeId={activeId} onSelect={selectConv} userId={user.id} />
          {isAdmin && <ConvSection title="Otros agentes" items={others} activeId={activeId} onSelect={selectConv} userId={user.id} />}
        </div>
      </div>

      {/* ── Right panel: chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Selecciona una conversación
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SemDot color={sColor} />
                  <span style={{ fontWeight: 600, color: '#111' }}>
                    {activeConv.contact_name || activeConv.phone}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>+{activeConv.phone}</span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {activeConv.assigned_to
                    ? <>Asignado a: <strong>{activeConv.assigned_name ?? activeConv.assigned_to}</strong></>
                    : 'Sin asignar'}
                  {' · '}
                  {activeConv.bot_active ? '🤖 Bot activo' : '👤 Humano'}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                {activeConv.bot_active && (
                  <button onClick={() => toggleBot(false)} style={btnStyle('#2563eb')}>
                    Tomar chat
                  </button>
                )}
                {!activeConv.bot_active && (
                  <button onClick={() => toggleBot(true)} style={btnStyle('#6b7280')}>
                    Devolver al bot
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>Cargando...</div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.direction === 'out' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                    background: msg.direction === 'out' ? '#2563eb' : '#fff',
                    color: msg.direction === 'out' ? '#fff' : '#111',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    borderBottomRightRadius: msg.direction === 'out' ? 2 : 12,
                    borderBottomLeftRadius: msg.direction === 'in' ? 2 : 12,
                  }}>
                    <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                    <div style={{
                      fontSize: 10, marginTop: 4, opacity: 0.7,
                      textAlign: msg.direction === 'out' ? 'right' : 'left',
                    }}>
                      {fmtFull(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 20px', background: '#fff', borderTop: '1px solid #e5e7eb',
              display: 'flex', gap: 8,
            }}>
              {activeConv.bot_active && (
                <div style={{
                  flex: 1, padding: '10px 14px', background: '#f3f4f6', borderRadius: 8,
                  color: '#9ca3af', fontSize: 13,
                }}>
                  Bot activo — haz clic en &ldquo;Tomar chat&rdquo; para escribir
                </div>
              )}
              {!activeConv.bot_active && (
                <>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    style={{
                      flex: 1, padding: '10px 14px', border: '1px solid #d1d5db',
                      borderRadius: 8, resize: 'none', fontSize: 14, outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !text.trim()}
                    style={btnStyle('#2563eb', sending || !text.trim())}
                  >
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

// ── Section of conversations ──────────────────────────────────────────────────
function ConvSection({
  title, items, activeId, onSelect, userId,
}: {
  title: string
  items: Conversation[]
  activeId: string | null
  onSelect: (c: Conversation) => void
  userId: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title} ({items.length})
      </div>
      {items.map(c => {
        const color = semaphoreColor(c.last_msg_at)
        const active = c.id === activeId
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              padding: '10px 16px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
              background: active ? '#eff6ff' : 'transparent',
              borderLeft: active ? '3px solid #2563eb' : '3px solid transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ marginTop: 5 }}>
              <SemDot color={color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, color: '#111', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.contact_name || `+${c.phone}`}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                  {fmtTime(c.last_msg_at)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {c.last_message || '—'}
              </div>
              {c.assigned_to && c.assigned_to !== userId && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  → {c.assigned_name ?? 'Agente'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    padding: '8px 16px', background: disabled ? '#e5e7eb' : bg, color: disabled ? '#9ca3af' : '#fff',
    border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', transition: 'background 0.15s',
  }
}
