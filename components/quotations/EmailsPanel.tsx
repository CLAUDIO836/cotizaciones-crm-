'use client'

import { useState, useEffect, useRef } from 'react'
import { Mail, Plus, Send, X, ChevronDown, ChevronUp, RefreshCw, ArrowDownLeft, Settings, Trash2, Pencil, Check, Paperclip } from 'lucide-react'
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
  id?:        string
  label:      string
  subject:    string
  body:       string
  scope?:     'team' | 'personal'
  created_by?: string
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
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
  quotationId:      string
  quotationNumber?: string
  clientEmail?:     string
  clientName?:      string
  createdAt?:       string
  userRole?:        string
  status?:          string
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

// ── Template Manager Modal ─────────────────────────────────────────────────────
function TemplateManager({
  templates, isAdmin, onClose, onSaved,
}: {
  templates: EmailTemplate[]
  isAdmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [editing,  setEditing]  = useState<EmailTemplate | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [err,      setErr]      = useState('')
  const isNew = editing && !editing.id

  function startNew(scope: 'team' | 'personal') {
    setEditing({ label: '', subject: '', body: '', scope })
    setErr('')
  }

  async function save() {
    if (!editing) return
    if (!editing.label.trim() || !editing.subject.trim() || !editing.body.trim()) {
      setErr('Nombre, asunto y mensaje son obligatorios')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const r = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Error al guardar')
      setEditing(null)
      onSaved()
    } catch (e) {
      setErr(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    setDeleting(id)
    try {
      const r = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Error')
      onSaved()
    } catch (e) {
      alert(String(e))
    } finally {
      setDeleting(null)
    }
  }

  const teamTpls     = templates.filter(t => t.scope === 'team'     || !t.scope)
  const personalTpls = templates.filter(t => t.scope === 'personal')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Gestionar plantillas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Editor */}
          {editing && (
            <div className="bg-gray-50 rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
                {editing.scope === 'team' ? ' · Equipo' : ' · Personal'}
              </p>
              <input
                type="text" placeholder="Nombre de la plantilla"
                value={editing.label}
                onChange={e => setEditing(v => v && { ...v, label: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              <input
                type="text" placeholder="Asunto del correo"
                value={editing.subject}
                onChange={e => setEditing(v => v && { ...v, subject: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              <textarea
                placeholder="Cuerpo del mensaje (usa {{nombre}} para el nombre del cliente)"
                value={editing.body}
                onChange={e => setEditing(v => v && { ...v, body: e.target.value })}
                rows={5}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
              />
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}
                  className="text-white text-xs h-7" style={{ background: '#1B8A4B' }}>
                  <Check className="w-3 h-3 mr-1" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}
                  className="text-xs h-7">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Equipo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Equipo</p>
              {isAdmin && !editing && (
                <button onClick={() => startNew('team')}
                  className="text-xs text-green-700 hover:underline font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Nueva
                </button>
              )}
            </div>
            {teamTpls.length === 0
              ? <p className="text-xs text-gray-300 italic">Sin plantillas de equipo</p>
              : teamTpls.map(t => (
                <div key={t.id ?? t.label} className="flex items-start gap-2 py-2 border-b last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.label}</p>
                    <p className="text-xs text-gray-400 truncate">{t.subject}</p>
                  </div>
                  {isAdmin && t.id && !editing && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditing(t); setErr('') }}
                        className="p-1 text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(t.id!)} disabled={deleting === t.id}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>

          {/* Personales */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mis plantillas</p>
              {!editing && (
                <button onClick={() => startNew('personal')}
                  className="text-xs text-green-700 hover:underline font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Nueva
                </button>
              )}
            </div>
            {personalTpls.length === 0
              ? <p className="text-xs text-gray-300 italic">Sin plantillas personales</p>
              : personalTpls.map(t => (
                <div key={t.id} className="flex items-start gap-2 py-2 border-b last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.label}</p>
                    <p className="text-xs text-gray-400 truncate">{t.subject}</p>
                  </div>
                  {t.id && !editing && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditing(t); setErr('') }}
                        className="p-1 text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(t.id!)} disabled={deleting === t.id}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function EmailsPanel({
  quotationId, quotationNumber, clientEmail = '', clientName = '', createdAt, userRole, status,
}: Props) {
  const [emails,           setEmails]           = useState<EmailRecord[]>([])
  const [loading,          setLoading]          = useState(true)
  const [composing,        setComposing]        = useState(false)
  const [sending,          setSending]          = useState(false)
  const [sendingOfficial,  setSendingOfficial]  = useState(false)
  const [officialMsg,      setOfficialMsg]      = useState('')
  const [syncing,          setSyncing]          = useState(false)
  const [syncMsg,          setSyncMsg]          = useState('')
  const [expanded,         setExpanded]         = useState<string | null>(null)
  const [error,            setError]            = useState('')
  const [copied,           setCopied]           = useState(false)
  const [showManage,       setShowManage]       = useState(false)

  // Compose fields
  const [to,         setTo]         = useState(clientEmail)
  const [tplOpen,    setTplOpen]    = useState(false)
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [attachPdf,  setAttachPdf]  = useState(false)

  // Templates
  const [templates,       setTemplates]       = useState<EmailTemplate[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  const tplRef = useRef<HTMLDivElement>(null)
  const bccAddress = quotationNumber
    ? `crm+negocio${quotationNumber.replace(/\D/g, '')}@transccl.cl`
    : null

  const isAdmin = userRole === 'admin' || userRole === 'superadmin'

  useEffect(() => { load().then(() => sync()) }, [quotationId])

  // Close template dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (tplRef.current && !tplRef.current.contains(e.target as Node)) setTplOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

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

  async function loadTemplates() {
    if (templatesLoaded) return
    try {
      const r = await fetch('/api/email-templates')
      const d = await r.json()
      const loaded: EmailTemplate[] = Array.isArray(d) ? d : (d.data ?? [])
      setTemplates(loaded.length ? loaded : DEFAULT_TEMPLATES)
    } catch {
      setTemplates(DEFAULT_TEMPLATES)
    } finally {
      setTemplatesLoaded(true)
    }
  }

  async function reloadTemplates() {
    setTemplatesLoaded(false)
    try {
      const r = await fetch('/api/email-templates')
      const d = await r.json()
      const loaded: EmailTemplate[] = Array.isArray(d) ? d : (d.data ?? [])
      setTemplates(loaded.length ? loaded : DEFAULT_TEMPLATES)
    } catch {
      setTemplates(DEFAULT_TEMPLATES)
    } finally {
      setTemplatesLoaded(true)
    }
  }

  async function sendOfficial() {
    if (!confirm('¿Enviar la cotización oficial al cliente con la plantilla de TransCCL (incluye link de aprobación y PDF adjunto)?')) return
    setSendingOfficial(true)
    setOfficialMsg('')
    try {
      const r = await fetch(`/api/quotations/${quotationId}/send-email`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Error al enviar')
      setOfficialMsg(`✓ Enviada a ${d.sent_to}`)
      await load()
    } catch (e) {
      setOfficialMsg(`Error: ${String(e)}`)
    } finally {
      setSendingOfficial(false)
      setTimeout(() => setOfficialMsg(''), 6000)
    }
  }

  async function sync() {
    setSyncing(true); setSyncMsg('')
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
    try { await navigator.clipboard.writeText(bccAddress) } catch { /* fallback */ }
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
    setAttachPdf(false)
    setError('')
    setComposing(true)
    if (!templatesLoaded) loadTemplates()
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Completa Para, Asunto y Mensaje')
      return
    }
    setSending(true)
    setError('')
    try {
      const prevThread = emails.find(e => e.to_email === to.trim())?.gmail_thread_id
      const html = body
        .split('\n')
        .map(l => `<p style="margin:0 0 8px">${l || '&nbsp;'}</p>`)
        .join('')

      const r = await fetch(`/api/quotations/${quotationId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), html, thread_id: prevThread, attachPdf }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Error al enviar')
      setComposing(false)
      setTo(clientEmail)
      setSubject('')
      setBody('')
      setAttachPdf(false)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const allTemplates = templatesLoaded ? templates : DEFAULT_TEMPLATES

  return (
    <div className="space-y-3">

      {/* Template Manager Modal */}
      {showManage && (
        <TemplateManager
          templates={templates.length ? templates : []}
          isAdmin={isAdmin}
          onClose={() => setShowManage(false)}
          onSaved={() => { reloadTemplates(); setShowManage(false) }}
        />
      )}

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

      {/* Enviar cotización oficial */}
      {status === 'open' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800">📧 Cotización oficial TransCCL</p>
            <p className="text-xs text-blue-500 mt-0.5">Envía la plantilla branded con el PDF adjunto y link de aprobación</p>
            {officialMsg && (
              <p className={`text-xs mt-1 font-medium ${officialMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                {officialMsg}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={sendOfficial}
            disabled={sendingOfficial}
            className="text-xs h-7 px-3 text-white flex-shrink-0"
            style={{ background: '#082e62' }}
          >
            <Send className="w-3 h-3 mr-1" />
            {sendingOfficial ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      )}

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
          <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Redactar correo</span>
            </div>
            <button
              onClick={() => { setShowManage(true); if (!templatesLoaded) loadTemplates() }}
              title="Gestionar plantillas"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {/* Selector de plantilla */}
            <div className="relative" ref={tplRef}>
              <button
                type="button"
                onClick={() => { setTplOpen(v => !v); if (!templatesLoaded) loadTemplates() }}
                className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors font-medium"
              >
                <span>📋 Usar plantilla</span>
                <span className="text-gray-400">{tplOpen ? '▲' : '▼'}</span>
              </button>
              {tplOpen && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {allTemplates.map((tpl, i) => (
                    <button key={tpl.id ?? i} type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b last:border-b-0 transition-colors">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 flex-1">{tpl.label}</p>
                        {tpl.scope === 'personal' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">mía</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Para */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Para</label>
              <input
                type="email" value={to} onChange={e => setTo(e.target.value)}
                placeholder="correo@cliente.cl"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            {/* Asunto */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Asunto</label>
              <input
                type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del correo"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            {/* Mensaje */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Mensaje</label>
              <textarea
                value={body} onChange={e => setBody(e.target.value)}
                rows={6}
                placeholder="Escribe tu mensaje aquí..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
              />
            </div>

            {/* Adjunto PDF */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={e => setAttachPdf(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-200"
              />
              <Paperclip className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-600 font-medium">Adjuntar PDF de la cotización</span>
              {attachPdf && <span className="text-xs text-amber-600 font-medium">(puede demorar unos segundos)</span>}
            </label>

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
                {sending ? (attachPdf ? 'Generando PDF y enviando...' : 'Enviando...') : 'Enviar desde Gmail'}
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
