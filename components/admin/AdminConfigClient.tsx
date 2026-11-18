'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Save, X, Mail, CreditCard, Bell } from 'lucide-react'

interface EmailTemplate {
  id:      string
  label:   string
  subject: string
  body:    string
}

const SECTION_TABS = [
  { key: 'templates', label: 'Plantillas de correo', Icon: Mail },
  { key: 'billing',   label: 'Formas de pago auth', Icon: CreditCard },
  { key: 'cron',      label: 'Recordatorios WA',    Icon: Bell },
]

export default function AdminConfigClient() {
  const [tab, setTab] = useState('templates')

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {SECTION_TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={tab === key ? { background: 'white', color: '#1B8A4B', boxShadow: '0 1px 3px rgba(0,0,0,.1)' } : { color: '#6b7280' }}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'templates' && <EmailTemplatesSection />}
      {tab === 'billing'   && <BillingAuthSection />}
      {tab === 'cron'      && <CronSection />}
    </div>
  )
}

/* ── Email Templates ── */
function EmailTemplatesSection() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState<Partial<EmailTemplate> | null>(null)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/email-templates')
    const d = await r.json()
    setTemplates(Array.isArray(d.data) ? d.data : [])
    setLoading(false)
  }

  async function save() {
    if (!editing?.label?.trim() || !editing.subject?.trim() || !editing.body?.trim()) return
    setSaving(true)
    await fetch('/api/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    await load()
    setEditing(null)
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await fetch('/api/email-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Plantillas personalizables para los ejecutivos. Se suman a las 4 predefinidas del sistema.</p>
        <button onClick={() => setEditing({ label: '', subject: '', body: '' })}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#1B8A4B' }}>
          <Plus className="w-3.5 h-3.5" /> Nueva plantilla
        </button>
      </div>

      {editing && (
        <div className="bg-gray-50 rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre de la plantilla</label>
              <input value={editing.label ?? ''} onChange={e => setEditing(v => ({ ...v, label: e.target.value }))}
                placeholder="Ej: Recordatorio de propuesta" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Asunto del correo</label>
              <input value={editing.subject ?? ''} onChange={e => setEditing(v => ({ ...v, subject: e.target.value }))}
                placeholder="Asunto que recibirá el cliente" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cuerpo — usa {'{{nombre}}'} para el nombre del cliente</label>
            <textarea value={editing.body ?? ''} onChange={e => setEditing(v => ({ ...v, body: e.target.value }))}
              rows={5} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none font-mono" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="text-sm text-gray-500 px-3 py-1.5">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#1B8A4B' }}>
              <Save className="w-3.5 h-3.5" />{saving ? 'Guardando...' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Sin plantillas personalizadas aún</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.subject}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(t)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Billing Auth ── */
function BillingAuthSection() {
  const [pending, setPending] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/billing/pending-auth')
    const d = await r.json()
    setPending(Array.isArray(d.data) ? d.data : [])
    setLoading(false)
  }

  async function approve(id: string) {
    await fetch('/api/billing/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
  if (pending.length === 0) return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
      <p className="text-sm font-medium text-green-700">Sin autorizaciones pendientes 🎉</p>
      <p className="text-xs text-gray-500 mt-1">Todos los créditos han sido aprobados</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Negocios ganados con forma de pago a crédito que requieren tu autorización.</p>
      {pending.map(b => (
        <div key={b.id as string} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">#{b.quotation_number as string} · {b.client_name as string}</p>
            <p className="text-xs text-gray-500 mt-0.5">Forma de pago: <span className="font-medium text-orange-600">{b.forma_pago as string}</span></p>
            <p className="text-xs text-gray-400">{b.billing_name as string} · {b.billing_rut as string}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">${Number(b.total ?? 0).toLocaleString('es-CL')}</span>
            <button onClick={() => approve(b.id as string)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
              style={{ background: '#1B8A4B' }}>
              ✓ Autorizar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Cron WA ── */
function CronSection() {
  const [result,       setResult]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [loadingNG,    setLoadingNG]    = useState(false)
  const [resultNG,     setResultNG]     = useState('')

  async function runNow() {
    setLoading(true); setResult('')
    const r = await fetch('/api/reminders/run-now', { method: 'POST' })
    setResult(JSON.stringify(await r.json(), null, 2))
    setLoading(false)
  }

  async function runNoGestion() {
    if (!confirm('¿Enviar WA a todos los ejecutivos con negocios sin gestión? Esto enviará mensajes reales.')) return
    setLoadingNG(true); setResultNG('')
    const r = await fetch('/api/reminders/no-gestion', { method: 'POST' })
    setResultNG(JSON.stringify(await r.json(), null, 2))
    setLoadingNG(false)
  }

  return (
    <div className="space-y-5">

      {/* Cron diario */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Recordatorio diario — gestiones vencidas</p>
        <p className="text-sm text-blue-700">Cada lunes a viernes a las 18:00 hrs el sistema envía un WhatsApp a cada ejecutivo con sus gestiones pendientes vencidas.</p>
      </div>
      <div>
        <button onClick={runNow} disabled={loading}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50">
          {loading ? 'Enviando...' : '▶ Probar ahora (gestiones vencidas)'}
        </button>
        {result && <pre className="mt-3 bg-gray-900 text-green-400 text-xs p-3 rounded-xl overflow-x-auto">{result}</pre>}
      </div>

      {/* Blast negocios sin gestión */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">🚨 Alerta masiva — negocios sin gestión</p>
        <p className="text-sm text-amber-700">Envía un WA a cada ejecutivo listando todos sus negocios abiertos que nunca tuvieron ninguna gestión registrada. Úsalo cuando quieras activar al equipo de una vez.</p>
      </div>
      <div>
        <button onClick={runNoGestion} disabled={loadingNG}
          className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: '#f97316' }}>
          {loadingNG ? 'Enviando...' : '📲 Enviar alerta a ejecutivos ahora'}
        </button>
        {resultNG && <pre className="mt-3 bg-gray-900 text-green-400 text-xs p-3 rounded-xl overflow-x-auto">{resultNG}</pre>}
      </div>

    </div>
  )
}
