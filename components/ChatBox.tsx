'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Loader2, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatBox() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok || !res.body) throw new Error('Error del servidor')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Ocurrió un error. Intenta nuevamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ width: 52, height: 52, background: '#1d4ed8' }}
          aria-label="Abrir asistente"
        >
          <MessageSquare size={22} color="#fff" />
          {messages.length === 0 && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
              style={{ background: '#22c55e' }}
            />
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 360,
            height: 500,
            background: 'var(--chat-bg, #fff)',
            border: '1px solid var(--chat-border, #e2e8f0)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
            style={{ background: '#1d4ed8' }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={15} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Asistente CRM</p>
              <p className="text-blue-200 text-xs">Transccl · Siempre disponible</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <ChevronDown size={16} color="#fff" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: '#f8fafc' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: '#dbeafe' }}
                >
                  <MessageSquare size={20} color="#1d4ed8" />
                </div>
                <p className="font-semibold text-slate-700 text-sm">¿En qué te puedo ayudar?</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Pregúntame sobre cotizaciones, contratos, clientes o cualquier duda del CRM.
                </p>
                <div className="mt-4 flex flex-col gap-2 w-full">
                  {['¿Cómo creo una cotización?', '¿Cómo genero un contrato?', '¿Dónde veo el pipeline?'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus() }}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-blue-100 text-blue-700 hover:bg-blue-50 transition-colors"
                      style={{ background: '#fff' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    m.role === 'user'
                      ? { background: '#1d4ed8', color: '#fff', borderBottomRightRadius: 4 }
                      : { background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderBottomLeftRadius: 4 }
                  }
                >
                  {m.content || (loading && i === messages.length - 1
                    ? <span className="flex gap-1 items-center py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'0ms'}} /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'300ms'}} /></span>
                    : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 py-3 border-t" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
            <div
              className="flex items-end gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: '#cbd5e1' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Escribe tu pregunta…"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400 disabled:opacity-60 max-h-24"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
                style={{ background: '#1d4ed8', marginBottom: 1 }}
                aria-label="Enviar"
              >
                {loading
                  ? <Loader2 size={13} color="#fff" className="animate-spin" />
                  : <Send size={13} color="#fff" />
                }
              </button>
            </div>
            <p className="text-center text-slate-300 text-[10px] mt-2">Impulsado por Claude · Respuestas pueden tener errores</p>
          </div>
        </div>
      )}
    </>
  )
}
