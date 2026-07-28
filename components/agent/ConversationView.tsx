'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Bot, User, Send, Zap, Pause, RefreshCw
} from 'lucide-react'
import type { AiConversationDetail } from '@/lib/ai-api'
import type { UserSession } from '@/lib/api'
import MessageBubble from './MessageBubble'
import DraftPanel from './DraftPanel'
import LeadContextPanel from './LeadContextPanel'

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta', medium: 'Media', low: 'Baja'
}
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#FEF2F2', text: '#DC2626' },
  medium: { bg: '#FFFBEB', text: '#D97706' },
  low:    { bg: '#F0FDF4', text: '#16A34A' },
}

interface Props {
  conversation: AiConversationDetail
  session: UserSession
}

export default function ConversationView({ conversation: initialConv, session }: Props) {
  const router = useRouter()
  const [conv] = useState(initialConv)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [togglingMode, setTogglingMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv.messages])

  const pendingDraft = conv.messages.find(
    m => m.sender === 'ai' && m.message_type === 'draft' && m.status === 'pending'
  )

  const priority = PRIORITY_COLORS[conv.priority] ?? PRIORITY_COLORS.medium

  async function handleSendMessage() {
    if (!messageText.trim()) return
    setSending(true)
    try {
      await fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conv.id,
          content: messageText.trim(),
          sender: 'human',
          message_type: 'sent',
        }),
      })
      setMessageText('')
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  async function handleGenerateDraft() {
    setGeneratingDraft(true)
    try {
      await fetch('/api/ai/messages/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conv.id,
          context: {
            empresa_nombre: conv.empresa_nombre,
            client_name: conv.client_name,
            tipo_servicio: conv.tipo_servicio,
          },
        }),
      })
      router.refresh()
    } finally {
      setGeneratingDraft(false)
    }
  }

  async function handleToggleMode() {
    const newMode = conv.mode === 'ai' ? 'human' : 'ai'
    setTogglingMode(true)
    try {
      await fetch(`/api/ai/conversations/${conv.id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      })
      router.refresh()
    } finally {
      setTogglingMode(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: '#E5E7EB', background: 'white' }}>
        <Link href="/agente" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {conv.empresa_nombre ?? conv.client_name ?? 'Conversación'}
            </p>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: priority.bg, color: priority.text }}>
              {PRIORITY_LABELS[conv.priority]}
            </span>
            {conv.company && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                {conv.company}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {conv.channel} · {conv.assigned_name ?? 'Sin responsable'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: conv.mode === 'ai' ? '#ECFDF5' : '#FFF7ED',
              color: conv.mode === 'ai' ? '#1B8A4B' : '#C2410C',
            }}>
            {conv.mode === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            {conv.mode === 'ai' ? 'Modo IA' : 'Modo Agente'}
          </div>
          {/* Toggle mode button */}
          <button
            onClick={handleToggleMode}
            disabled={togglingMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60"
            style={conv.mode === 'ai'
              ? { borderColor: '#BFDBFE', color: '#1D4ED8', background: '#EFF6FF' }
              : { borderColor: '#BBF7D0', color: '#166534', background: '#F0FDF4' }
            }
          >
            {conv.mode === 'ai'
              ? <><User className="w-3 h-3" /> Tomar control</>
              : <><Bot className="w-3 h-3" /> Pasar a IA</>
            }
          </button>
        </div>
      </div>

      {/* Body: thread + sidepanel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {conv.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Bot className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Sin mensajes aún</p>
              </div>
            )}
            {conv.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t p-3 bg-white" style={{ borderColor: '#E5E7EB' }}>
            {conv.mode === 'ai' && !pendingDraft && (
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={handleGenerateDraft}
                  disabled={generatingDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60"
                  style={{ borderColor: '#BBF7D0', color: '#1B8A4B', background: '#F0FDF4' }}
                >
                  <RefreshCw className={`w-3 h-3 ${generatingDraft ? 'animate-spin' : ''}`} />
                  {generatingDraft ? 'Generando…' : 'Generar borrador IA'}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                placeholder="Escribe un mensaje como agente…"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                rows={2}
                className="flex-1 text-sm rounded-xl border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                style={{ borderColor: '#D1D5DB' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className="w-9 h-9 self-end rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: '#1B8A4B' }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Right sidepanel */}
        <div className="w-72 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
          {pendingDraft && (
            <div className="p-3 border-b" style={{ borderColor: '#E5E7EB' }}>
              <DraftPanel draft={pendingDraft} conv={conv} />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <LeadContextPanel conv={conv} />
          </div>
        </div>
      </div>
    </div>
  )
}
