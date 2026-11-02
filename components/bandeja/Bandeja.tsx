'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserSession } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage  = 'nuevo' | 'cotizando' | 'ganado' | 'perdido' | 'cerrado'
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
  last_customer_msg_at: string | null
  unread_count: number
  notes: string | null
  contact_rut: string | null
  service_date: string | null
  contact_email: string | null
  service_origin: string | null
  service_destination: string | null
  service_passengers: number | null
  service_type: string | null
  created_at: string | null
}

interface Message {
  id: string
  direction: 'in' | 'out'
  content: string
  msg_type: string
  status: string
  sender_type: string | null
  created_at: string
}

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES: { id: Stage; label: string; color: string; bg: string; dot: string }[] = [
  { id: 'nuevo',      label: 'Nuevo',              color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  { id: 'cotizando',  label: 'Preparando cotiz.',  color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
  { id: 'ganado',     label: 'Ganado',             color: '#166534', bg: '#f0fdf4', dot: '#22c55e' },
  { id: 'perdido',    label: 'Perdido',            color: '#991b1b', bg: '#fef2f2', dot: '#ef4444' },
  { id: 'cerrado',    label: 'Cerrado',            color: '#4b5563', bg: '#f9fafb', dot: '#9ca3af' },
]
const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]))

const SOURCES: { id: Source; label: string; icon: string }[] = [
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { id: 'facebook',  label: 'Facebook',  icon: '📘' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'google',    label: 'Google',    icon: '🔍' },
  { id: 'referido',  label: 'Referido',  icon: '🤝' },
  { id: 'otro',      label: 'Otro',      icon: '📌' },
]
const sourceMap = Object.fromEntries(SOURCES.map(s => [s.id, s]))

// ── Helpers ───────────────────────────────────────────────────────────────────
function isBusinessHours(): boolean {
  const now   = new Date()
  const chile = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const day   = chile.getUTCDay()
  const mins  = chile.getUTCHours() * 60 + chile.getUTCMinutes()
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
  const d   = new Date(dt)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function fmtFull(dt: string): string {
  return new Date(dt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function get24hRemaining(lastCustomerMsgAt: string | null): string | null {
  if (!lastCustomerMsgAt) return null
  const expiry = new Date(lastCustomerMsgAt).getTime() + 24 * 60 * 60 * 1000
  const diff   = expiry - Date.now()
  if (diff <= 0) return 'Ventana cerrada'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
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

function StatusIcon({ status, direction }: { status: string; direction: 'in' | 'out' }) {
  if (direction !== 'out') return null
  if (status === 'read')      return <span style={{ color: '#34b7f1', fontSize: 11, marginLeft: 3 }}>✓✓</span>
  if (status === 'delivered') return <span style={{ color: '#aaa',    fontSize: 11, marginLeft: 3 }}>✓✓</span>
  if (status === 'sent')      return <span style={{ color: '#aaa',    fontSize: 11, marginLeft: 3 }}>✓</span>
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Bandeja({ user, initialExec = 'todos' }: { user: UserSession; initialExec?: string }) {
  const isAdmin = user.role === 'admin'
  const router  = useRouter()

  const [view, setView]               = useState<'list' | 'kanban'>('list')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [agents, setAgents]           = useState<{ id: string; name: string }[]>([])
  const [allAgents, setAllAgents]     = useState<{ id: string; name: string }[]>([])

  const [tabExec, setTabExec]             = useState<string>(initialExec)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId]           = useState<string | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [activeConv, setActiveConv]       = useState<Conversation | null>(null)
  const [text, setText]                   = useState('')
  const [sending, setSending]             = useState(false)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)

  // Right panel state (saved on blur)
  const [rightNotes, setRightNotes]         = useState('')
  const [rightRut, setRightRut]             = useState('')
  const [rightDate, setRightDate]           = useState('')
  const [rightEmail, setRightEmail]         = useState('')
  const [rightOrigin, setRightOrigin]       = useState('')
  const [rightDestino, setRightDestino]     = useState('')
  const [rightPax, setRightPax]             = useState('')
  const [rightTipo, setRightTipo]           = useState('')
  const [now, setNow] = useState(Date.now())

  // Sync tab when navigating from sidebar
  useEffect(() => { setTabExec(initialExec) }, [initialExec])

  // Sync right panel when activeConv updated by polling (bot fills fields)
  useEffect(() => {
    if (!activeConv) return
    setRightNotes(activeConv.notes ?? '')
    setRightRut(activeConv.contact_rut ?? '')
    setRightDate(activeConv.service_date ?? '')
    setRightEmail(activeConv.contact_email ?? '')
    setRightOrigin(activeConv.service_origin ?? '')
    setRightDestino(activeConv.service_destination ?? '')
    setRightPax(activeConv.service_passengers?.toString() ?? '')
    setRightTipo(activeConv.service_type ?? '')
  }, [activeConv?.id]) // only when conversation changes, not on every update

  // Tick cada 30s para actualizar el cronómetro 24h en vivo
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(iv)
  }, [])

  // Scroll refs
  const messagesEndRef       = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef        = useRef(true)
  const hasLoadedRef         = useRef(false)

  const lastSeenAt = useRef<Record<string, string>>({})
  const notifPerm  = useRef<NotificationPermission>('default')

  function handleScroll() {
    const el = messagesContainerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // Scroll to bottom only if user was already at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Request notifications permission
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    notifPerm.current = Notification.permission
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { notifPerm.current = p })
    }
  }, [])

  // Load agents list (solo no-admin para los tabs)
  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; name: string; active: number; role?: string }[]) =>
        setAllAgents(rows.filter(r => r.active && r.role !== 'admin').map(r => ({ id: r.id, name: r.name })))
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

      // Browser notifications for new messages
      if (notifPerm.current === 'granted' && Object.keys(lastSeenAt.current).length > 0) {
        for (const conv of data) {
          const prev      = lastSeenAt.current[conv.id]
          const isNew     = !prev
          const hasNewMsg = prev && conv.last_msg_at && conv.last_msg_at > prev
          if ((isNew || hasNewMsg) && conv.id !== activeId) {
            const name  = conv.contact_name || `+${conv.phone}`
            const notif = new Notification(`💬 ${name}`, {
              body: conv.last_message || 'Nuevo mensaje',
              icon: '/favicon.ico',
              tag:  conv.id,
            })
            notif.onclick = () => { window.focus(); notif.close() }
          }
        }
      }
      for (const conv of data) {
        if (conv.last_msg_at) lastSeenAt.current[conv.id] = conv.last_msg_at
      }

      setConversations(data)
      if (activeId) {
        const updated = data.find(c => c.id === activeId)
        if (updated) setActiveConv(updated)
      }
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
      // Only jump to bottom on first load — subsequent polls preserve scroll position
      const firstLoad = !hasLoadedRef.current
      setMessages(data.messages ?? [])
      setActiveConv(data.conversation ?? null)
      hasLoadedRef.current = true
      if (firstLoad) isAtBottomRef.current = true
    } catch { /* ignore */ } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    const iv = setInterval(() => loadMessages(activeId), 5000)
    return () => clearInterval(iv)
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectConv(conv: Conversation) {
    setActiveId(conv.id)
    setActiveConv(conv)
    setMessages([])
    hasLoadedRef.current = false
    isAtBottomRef.current = true
    // Populate right panel
    setRightNotes(conv.notes ?? '')
    setRightRut(conv.contact_rut ?? '')
    setRightDate(conv.service_date ?? '')
    setRightEmail(conv.contact_email ?? '')
    setRightOrigin(conv.service_origin ?? '')
    setRightDestino(conv.service_destination ?? '')
    setRightPax(conv.service_passengers?.toString() ?? '')
    setRightTipo(conv.service_type ?? '')
    // Mark as read
    if (conv.unread_count > 0) {
      fetch('/api/whatsapp/cloud/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: conv.id }),
      }).catch(() => {})
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    }
  }

  async function saveNote() {
    if (!activeId) return
    await fetch('/api/whatsapp/cloud/note', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conv_id: activeId,
        notes: rightNotes,
        contact_rut: rightRut,
        service_date: rightDate,
        contact_email: rightEmail || null,
        service_origin: rightOrigin || null,
        service_destination: rightDestino || null,
        service_passengers: rightPax ? parseInt(rightPax) : null,
        service_type: rightTipo || null,
      }),
    }).catch(() => {})
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
      ...prev, assigned_to: assignedTo, assigned_name: agent?.name ?? null,
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
        isAtBottomRef.current = true
        if (activeId) await loadMessages(activeId)
        await loadConversations()
      }
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

  function selectTab(id: string) {
    setTabExec(id)
    router.replace(`/bandeja?exec=${id}`, { scroll: false })
  }

  // ── Tab-filtered list ─────────────────────────────────────────────────────
  const tabFiltered = conversations.filter(c => {
    if (tabExec === 'todos')      return true
    if (tabExec === 'sinasignar') return !c.assigned_to
    return c.assigned_to === tabExec
  })
  const unread = (id: string) =>
    conversations.filter(c => c.assigned_to === id && (c.unread_count ?? 0) > 0).length

  // ── Groups for list view ──────────────────────────────────────────────────
  const unassigned = tabFiltered.filter(c => !c.assigned_to)
  const mine       = tabFiltered.filter(c => c.assigned_to === user.id)
  const others     = isAdmin ? tabFiltered.filter(c => c.assigned_to && c.assigned_to !== user.id) : []

  const sColor     = activeConv ? semaphoreColor(activeConv.last_msg_at) : 'gray'
  const timer24h   = get24hRemaining(activeConv?.last_customer_msg_at ?? null)
  // Compute diff directly for accurate color (avoid parseInt string-parse bug)
  const _timerDiffMs = activeConv?.last_customer_msg_at
    ? Math.max(0, new Date(activeConv.last_customer_msg_at).getTime() + 24 * 3600000 - now)
    : -1
  const timerColor = _timerDiffMs < 0 ? '#9ca3af'
    : _timerDiffMs === 0 ? '#ef4444'
    : _timerDiffMs < 6 * 3600000 ? '#f59e0b'
    : '#16a34a'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>
                {tabExec === 'todos'      ? 'Todos'
                 : tabExec === 'sinasignar' ? 'Sin asignar'
                 : allAgents.find(a => a.id === tabExec)?.name.split(' ')[0] ?? 'Bandeja'}
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>{tabFiltered.length} conversaciones</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('list')}   style={viewBtn(view === 'list')}>☰</button>
              <button onClick={() => setView('kanban')} style={viewBtn(view === 'kanban')}>⊞</button>
            </div>
          </div>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={selectStyle}>
            <option value="">Todas las etapas</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* List or Kanban */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'list' ? (
            <>
              {tabExec === 'todos' ? (
                <>
                  <ConvSection title="Sin asignar" items={unassigned} activeId={activeId} onSelect={selectConv} userId={user.id} />
                  <ConvSection title="Mis chats"   items={mine}       activeId={activeId} onSelect={selectConv} userId={user.id} />
                  {isAdmin && <ConvSection title="Otros agentes" items={others} activeId={activeId} onSelect={selectConv} userId={user.id} />}
                </>
              ) : tabExec === 'sinasignar' ? (
                <ConvSection title="Sin asignar" items={unassigned} activeId={activeId} onSelect={selectConv} userId={user.id} />
              ) : (
                <ConvSection
                  title={allAgents.find(a => a.id === tabExec)?.name ?? 'Ejecutivo'}
                  items={tabFiltered}
                  activeId={activeId}
                  onSelect={selectConv}
                  userId={user.id}
                />
              )}
            </>
          ) : (
            <KanbanPanel conversations={conversations} activeId={activeId} onSelect={selectConv} />
          )}
        </div>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb', minWidth: 0 }}>
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
                  <select
                    value={activeConv.source ?? 'whatsapp'}
                    onChange={e => changeSource(e.target.value as Source)}
                    style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}
                  >
                    {SOURCES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                  <select
                    value={activeConv.stage ?? 'nuevo'}
                    onChange={e => changeStage(e.target.value as Stage)}
                    style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}
                  >
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  {activeConv.bot_active
                    ? <button onClick={() => toggleBot(false)} style={btnStyle('#2563eb')}>Tomar chat</button>
                    : <button onClick={() => toggleBot(true)}  style={btnStyle('#6b7280')}>Devolver al bot</button>
                  }
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
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>Cargando...</div>
              )}
              {messages.map(msg => {
                const isBot = msg.direction === 'out' && msg.sender_type === 'bot'
                const isHuman = msg.direction === 'out' && msg.sender_type === 'human'
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                    {msg.direction === 'out' && (
                      <span style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, marginRight: 4 }}>
                        {isBot ? '🤖 Bot' : isHuman ? '👤 Ejecutivo' : ''}
                      </span>
                    )}
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                      background: msg.direction === 'out' ? (isBot ? '#7c3aed' : '#2563eb') : '#fff',
                      color: msg.direction === 'out' ? '#fff' : '#111',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      borderBottomRightRadius: msg.direction === 'out' ? 2 : 12,
                      borderBottomLeftRadius:  msg.direction === 'in'  ? 2 : 12,
                    }}>
                      <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: msg.direction === 'out' ? 'right' : 'left', display: 'flex', justifyContent: msg.direction === 'out' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 2 }}>
                        {fmtFull(msg.created_at)}
                        <StatusIcon status={msg.status} direction={msg.direction} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
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

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      {activeConv && (
        <div style={{ width: 260, borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 12 }}>Ficha del cliente</div>

            {/* Nombre */}
            <RightField label="Nombre" value={activeConv.contact_name || '—'} />

            {/* Teléfono con click-to-call */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Teléfono</div>
              <a href={`tel:+${activeConv.phone}`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                📞 +{activeConv.phone}
              </a>
            </div>

            {/* RUT */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>RUT</div>
              <input
                value={rightRut}
                onChange={e => setRightRut(e.target.value)}
                onBlur={saveNote}
                placeholder="12.345.678-9"
                style={rightInputStyle}
              />
            </div>

            {/* Fecha servicio */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Fecha de servicio</div>
              <input
                type="date"
                value={rightDate}
                onChange={e => setRightDate(e.target.value)}
                onBlur={saveNote}
                style={rightInputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Email</div>
              <input
                value={rightEmail}
                onChange={e => setRightEmail(e.target.value)}
                onBlur={saveNote}
                placeholder="correo@ejemplo.com"
                style={rightInputStyle}
              />
            </div>

            {/* Origen */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Origen</div>
              <input
                value={rightOrigin}
                onChange={e => setRightOrigin(e.target.value)}
                onBlur={saveNote}
                placeholder="Dirección de salida"
                style={rightInputStyle}
              />
            </div>

            {/* Destino */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Destino</div>
              <input
                value={rightDestino}
                onChange={e => setRightDestino(e.target.value)}
                onBlur={saveNote}
                placeholder="Destino del servicio"
                style={rightInputStyle}
              />
            </div>

            {/* N° pasajeros */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>N° pasajeros</div>
              <input
                type="number"
                value={rightPax}
                onChange={e => setRightPax(e.target.value)}
                onBlur={saveNote}
                placeholder="45"
                style={rightInputStyle}
              />
            </div>

            {/* Tipo servicio */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Tipo servicio</div>
              <input
                value={rightTipo}
                onChange={e => setRightTipo(e.target.value)}
                onBlur={saveNote}
                placeholder="Ej: salida educativa"
                style={rightInputStyle}
              />
            </div>

            {/* Ventana 24h */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>Ventana WA (24h)</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: timerColor }}>
                {timer24h ?? 'Sin mensajes del cliente'}
              </div>
            </div>
          </div>

          {/* Notas */}
          <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>Notas internas</div>
            <textarea
              value={rightNotes}
              onChange={e => setRightNotes(e.target.value)}
              onBlur={saveNote}
              placeholder="Escribe notas sobre este cliente…"
              style={{
                flex: 1, minHeight: 120, padding: '8px 10px', border: '1px solid #e5e7eb',
                borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                outline: 'none', color: '#374151', lineHeight: 1.5,
              }}
            />
            <div style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>Se guarda al perder foco</div>
          </div>
        </div>
      )}
    </div>
  )
}

function RightField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111' }}>{value}</div>
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
              padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: `2px solid ${stage.dot}`, background: stage.bg,
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
              const color  = semaphoreColor(c.last_msg_at)
              const active = c.id === activeId
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c)}
                  style={{
                    padding: '9px 16px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                    background: active ? '#eff6ff' : c.unread_count > 0 ? '#fefce8' : 'transparent',
                    borderLeft: active ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                >
                  <div style={{ marginTop: 5 }}><SemDot color={color} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contact_name || `+${c.phone}`}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtTime(c.last_msg_at)}</span>
                    </div>
                    {c.assigned_name && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>→ {c.assigned_name}</div>
                    )}
                    {c.unread_count > 0 && (
                      <span style={{ display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 700, background: '#eab308', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                        {c.unread_count}
                      </span>
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
        const color   = semaphoreColor(c.last_msg_at)
        const active  = c.id === activeId
        const unread  = c.unread_count > 0
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              padding: '9px 16px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
              background: active ? '#eff6ff' : unread ? '#fefce8' : 'transparent',
              borderLeft: active ? '3px solid #2563eb' : unread ? '3px solid #eab308' : '3px solid transparent',
            }}
          >
            <div style={{ marginTop: 5 }}><SemDot color={color} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: unread ? 700 : 500, color: '#111', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.contact_name || `+${c.phone}`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  {unread && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#eab308', color: '#fff', borderRadius: 10, padding: '1px 5px' }}>
                      {c.unread_count}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtTime(c.last_msg_at)}</span>
                </div>
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

const rightInputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6,
  fontSize: 13, color: '#374151', background: '#fff', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}
