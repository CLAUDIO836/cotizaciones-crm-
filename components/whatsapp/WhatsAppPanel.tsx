'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, RefreshCw, MessageCircle } from 'lucide-react'

type WaMessage = {
  id: string
  direction: 'in' | 'out'
  message: string
  timestamp?: number
  created_at?: string
  senderName?: string
  source?: string
}

const TEMPLATES = [
  'Hola, soy {name} de TransCCL. Te contactamos para presentarte nuestro servicio de traslado escolar. ¿Tienes un momento?',
  'Hola {contact}, te escribo por el servicio de transporte escolar. ¿Te puedo contar brevemente de qué se trata?',
  'Buenos días, te enviamos la cotización que solicitaste. ¿Tienes alguna consulta?',
]

export default function WhatsAppPanel({
  phone,
  contactName,
  prospectId,
  contactId,
  userName,
}: {
  phone: string
  contactName: string
  prospectId: string
  contactId?: string
  userName: string
}) {
  const [messages, setMessages]   = useState<WaMessage[]>([])
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/whatsapp/messages?phone=${encodeURIComponent(phone)}&prospectId=${prospectId}`
      )
      const d = await res.json()
      if (d.error) setError(d.error)
      else setMessages(d.messages ?? [])
    } catch {
      setError('No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }, [phone, prospectId])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone:    phone,
          message:    msg,
          prospectId,
          contactId,
        }),
      })
      const d = await res.json()
      if (d.error) {
        setError(d.error)
      } else {
        setText('')
        setMessages(prev => [...prev, {
          id:        d.messageId ?? Date.now().toString(),
          direction: 'out',
          message:   msg,
          timestamp: Date.now(),
          senderName: userName,
        }])
      }
    } catch {
      setError('Error al enviar')
    } finally {
      setSending(false)
    }
  }

  function applyTemplate(tpl: string) {
    setText(tpl.replace('{name}', userName).replace('{contact}', contactName))
    setShowTemplates(false)
  }

  function formatTime(msg: WaMessage) {
    const ts = msg.timestamp ? new Date(msg.timestamp) : msg.created_at ? new Date(msg.created_at) : null
    if (!ts) return ''
    return ts.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-gray-800">WhatsApp</span>
          <span className="text-xs text-gray-400">{phone}</span>
        </div>
        <button onClick={loadMessages} disabled={loading}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 && !loading && !error && (
          <p className="text-xs text-gray-400 text-center mt-8">
            Sin mensajes con {contactName}.<br />
            Usa las plantillas para comenzar.
          </p>
        )}
        {error && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
              m.direction === 'out'
                ? 'bg-green-500 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
            }`}>
              <p className="break-words">{m.message}</p>
              <p className={`text-[10px] mt-0.5 text-right ${m.direction === 'out' ? 'text-green-100' : 'text-gray-400'}`}>
                {formatTime(m)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 flex flex-col gap-1">
          {TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => applyTemplate(t)}
              className="text-left text-xs text-gray-700 hover:bg-white rounded px-2 py-1.5 truncate border border-transparent hover:border-gray-200 transition-colors">
              {t.replace('{name}', userName).replace('{contact}', contactName)}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-gray-100 p-2 flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button onClick={() => setShowTemplates(s => !s)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
              showTemplates
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            Plantillas
          </button>
        </div>
        <div className="flex gap-1.5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={2}
            placeholder="Escribe un mensaje…"
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <button onClick={send} disabled={sending || !text.trim()}
            className="w-9 h-9 mt-auto flex items-center justify-center rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
