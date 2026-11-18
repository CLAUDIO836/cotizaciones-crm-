'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Send, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmailRecord {
  id: string
  from_email: string
  to_email: string
  subject: string
  body_html?: string
  sent_at: string
  gmail_thread_id?: string
}

interface Props {
  quotationId: string
  clientEmail?: string
  clientName?: string
}

function timeAgo(dateStr: string): string {
  const d    = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'hace un momento'
  if (mins < 60)  return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

export default function EmailsPanel({ quotationId, clientEmail = '', clientName = '' }: Props) {
  const [emails, setEmails]       = useState<EmailRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [composing, setComposing] = useState(false)
  const [sending, setSending]     = useState(false)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [error, setError]         = useState('')

  const [to, setTo]           = useState(clientEmail)
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')

  useEffect(() => { load() }, [quotationId])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/emails?quotation_id=${quotationId}`)
      const d = await r.json()
      setEmails(Array.isArray(d) ? d : (d.data ?? []))
    } finally {
      setLoading(false)
    }
  }

  function openCompose(replyTo?: EmailRecord) {
    if (replyTo) {
      setTo(replyTo.to_email)
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
    } else {
      setTo(clientEmail)
      setSubject('')
    }
    setBody('')
    setError('')
    setComposing(true)
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Completa Para, Asunto y Mensaje')
      return
    }
    setSending(true)
    setError('')
    try {
      // Buscar thread_id del último correo al mismo destinatario para encadenar
      const prevThread = emails.find(e => e.to_email === to.trim())?.gmail_thread_id
      const html = body
        .split('\n')
        .map(l => `<p style="margin:0 0 8px">${l || '&nbsp;'}</p>`)
        .join('')

      const r = await fetch(`/api/quotations/${quotationId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), html, thread_id: prevThread }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Error al enviar')
      setComposing(false)
      setTo(clientEmail)
      setSubject('')
      setBody('')
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Correos enviados
          {emails.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {emails.length}
            </span>
          )}
        </h3>
        <Button
          size="sm"
          className="text-xs h-7 px-3 text-white"
          style={{ background: '#1B8A4B' }}
          onClick={() => composing ? setComposing(false) : openCompose()}
        >
          {composing ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {composing ? 'Cancelar' : 'Nuevo correo'}
        </Button>
      </div>

      {/* Redactor */}
      {composing && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Redactar correo</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Para</label>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="correo@cliente.cl"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Asunto</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del correo"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Mensaje</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                placeholder="Escribe tu mensaje aquí..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                className="text-white text-xs h-8 px-4"
                style={{ background: '#1B8A4B' }}
                onClick={handleSend}
                disabled={sending}
              >
                <Send className="w-3 h-3 mr-1.5" />
                {sending ? 'Enviando...' : 'Enviar desde Gmail'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de correos */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
      ) : emails.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <Mail className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Sin correos enviados desde este negocio</p>
          <p className="text-xs text-gray-300 mt-1">Los correos que envíes aquí quedarán registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(e => (
            <div key={e.id} className="bg-white rounded-xl border overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-900 truncate">{e.subject}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    Para: {e.to_email} · {timeAgo(e.sent_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Enviado</span>
                  {expanded === e.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  }
                </div>
              </button>

              {expanded === e.id && e.body_html && (
                <div className="border-t px-4 py-3">
                  <div
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: e.body_html }}
                  />
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      De: {e.from_email} · {new Date(e.sent_at).toLocaleString('es-CL')}
                    </span>
                    <button
                      className="text-xs text-blue-600 hover:underline font-medium"
                      onClick={() => openCompose(e)}
                    >
                      Responder
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
