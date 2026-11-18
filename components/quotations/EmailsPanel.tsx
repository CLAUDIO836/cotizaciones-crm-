'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Send, X, ChevronDown, ChevronUp, RefreshCw, ArrowDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmailRecord {
  id: string
  from_email: string
  to_email: string
  subject: string
  body_html?: string
  sent_at: string
  gmail_thread_id?: string
  direction?: 'sent' | 'received'
}

interface EmailTemplate {
  label:   string
  subject: string
  body:    string
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    label:   '📄 Envío de cotización',
    subject: 'Cotización de servicio de traslado – TransCCL',
    body:    'Estimado/a {{nombre}},\n\nAdjunto nuestra propuesta para el servicio solicitado. Hemos preparado una solución a medida para sus necesidades de traslado.\n\nQuedamos atentos a cualquier consulta o ajuste que requiera.\n\nSaludos cordiales,',
  },
  {
    label:   '🔁 Seguimiento de propuesta',
    subject: 'Seguimiento cotización TransCCL',
    body:    'Estimado/a {{nombre}},\n\nQuisiera consultar si ha tenido la oportunidad de revisar nuestra propuesta. Estamos disponibles para resolver cualquier duda o coordinar una reunión si lo prefiere.\n\n¿Tiene alguna consulta sobre la cotización?\n\nSaludos cordiales,',
  },
  {
    label:   '✅ Confirmación de servicio',
    subject: 'Confirmación de servicio – TransCCL',
    body:    'Estimado/a {{nombre}},\n\nNos complace confirmar que hemos recibido su confirmación para el servicio de traslado. En los próximos días nos comunicaremos para coordinar los detalles operativos.\n\nMuchas gracias por elegir TransCCL.\n\nSaludos cordiales,',
  },
  {
    label:   '🙏 Gracias por considerarnos',
    subject: 'Gracias por considerarnos – TransCCL',
    body:    'Estimado/a {{nombre}},\n\nAgradecemos la oportunidad que nos dio de presentar nuestra propuesta. Lamentamos no haber podido concretar esta vez, pero quedamos a su disposición para futuras necesidades de traslado.\n\nSaludos cordiales,',
  },
]

interface Props {
  quotationId:     string
  quotationNumber?: string
  clientEmail?:    string
  clientName?:     string
  createdAt?:      string
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

export default function EmailsPanel({ quotationId, quotationNumber, clientEmail = '', clientName = '', createdAt }: Props) {
  const [emails, setEmails]       = useState<EmailRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [composing, setComposing] = useState(false)
  const [sending, setSending]     = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [error, setError]         = useState('')

  const [copied, setCopied]   = useState(false)
  const [to, setTo]             = useState(clientEmail)
  const [tplOpen, setTplOpen]   = useState(false)
  const bccAddress = quotationNumber
    ? `crm+negocio${quotationNumber.replace(/\D/g, '')}@transccl.cl`
    : null
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')

  useEffect(() => { load().then(() => sync()) }, [quotationId])

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

  async function sync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await fetch(`/api/quotations/${quotationId}/sync-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, createdAt }),
      })
      const d = await r.json()
      if (d.error) { setSyncMsg(`Error: ${d.error}`); return }
      if (d.synced > 0) { await load(); setSyncMsg(`+${d.synced} correo${d.synced > 1 ? 's' : ''} nuevos`) }
      else setSyncMsg('Al día — sin correos nuevos')
    } catch (e) {
      setSyncMsg(`Error: ${String(e)}`)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  async function copyBcc() {
    if (!bccAddress) return
    try { await navigator.clipboard.writeText(bccAddress) } catch { /* fallback silencioso */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function applyTemplate(tpl: EmailTemplate) {
    const nombre = clientName || 'cliente'
    setSubject(tpl.subject)
    setBody(tpl.body.replace(/\{\{nombre\}\}/g, nombre))
    setTplOpen(false)
    setComposing(true)
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
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Correos
          {emails.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {emails.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : syncMsg || 'Sincronizar'}
          </button>
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
      </div>

      {/* BCC address */}
      {bccAddress && (
        <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium mb-0.5">📋 BCC en tus correos de Gmail</p>
            <p className="text-xs font-mono text-gray-600 truncate">{bccAddress}</p>
          </div>
          <button
            onClick={copyBcc}
            className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg border bg-white hover:bg-gray-50 font-medium text-gray-600 transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      {/* Redactor */}
      {composing && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Redactar correo</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Selector de plantilla */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTplOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors font-medium"
              >
                <span>📋 Usar plantilla</span>
                <span className="text-gray-400">{tplOpen ? '▲' : '▼'}</span>
              </button>
              {tplOpen && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
                  {EMAIL_TEMPLATES.map(tpl => (
                    <button key={tpl.label} type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b last:border-b-0 transition-colors">
                      <p className="font-medium text-gray-800">{tpl.label}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          {emails.map(e => {
            const isReceived = e.direction === 'received'
            return (
              <div key={e.id} className={`rounded-xl border overflow-hidden ${isReceived ? 'bg-blue-50 border-blue-100' : 'bg-white'}`}>
                <button
                  className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-black/5 transition-colors"
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isReceived && <ArrowDownLeft className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                      <span className="text-xs font-semibold text-gray-900 truncate">{e.subject}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {isReceived ? `De: ${e.from_email}` : `Para: ${e.to_email}`} · {timeAgo(e.sent_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isReceived
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">Recibido</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Enviado</span>
                    }
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
                      {!isReceived && (
                        <button
                          className="text-xs text-blue-600 hover:underline font-medium"
                          onClick={() => openCompose(e)}
                        >
                          Responder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
