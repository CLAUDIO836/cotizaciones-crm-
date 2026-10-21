'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Prospect, Campaign, ProspectStatus, STATUS_LABELS, STATUS_COLORS,
  ACTIVITY_LABELS, ACTIVITY_ICONS, RESULT_LABELS, ActivityType, ActivityResult,
} from '@/lib/prospectos-types'
import { UserSession } from '@/lib/api'
import BotonLlamada from './BotonLlamada'
import WhatsAppPanel from '@/components/whatsapp/WhatsAppPanel'

const RESULTS: { value: ActivityResult, label: string }[] = [
  { value: 'contacted',       label: '✅ Contactado' },
  { value: 'no_answer',       label: '🚫 No contestó' },
  { value: 'follow_up',       label: '⏰ Volver a llamar' },
  { value: 'interested',      label: '🤝 Interesado' },
  { value: 'not_interested',  label: '❌ No interesado' },
  { value: 'quote_requested', label: '💰 Pidió cotización' },
]

const PIPELINE_STEPS: { status: ProspectStatus, label: string, icon: string }[] = [
  { status: 'new',         label: 'Sin contactar',   icon: '📋' },
  { status: 'contacted',   label: 'Contactado',      icon: '📞' },
  { status: 'following',   label: 'En seguimiento',  icon: '🔄' },
  { status: 'quoting',     label: 'Cotizando',       icon: '💰' },
  { status: 'closed_won',  label: 'Ganado',          icon: '✅' },
  { status: 'closed_lost', label: 'Perdido',         icon: '❌' },
]

function formatDuration(sec: number | null) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')} min`
}

export default function ProspectoFicha({
  prospect: initial, campaign, profiles, user,
}: {
  prospect: Prospect
  campaign: Campaign | null
  profiles: { id: string; name: string; email: string; role: string }[]
  user: UserSession
}) {
  const router = useRouter()
  const [prospect, setProspect] = useState(initial)
  const [actType, setActType] = useState<ActivityType>('call')
  const [actResult, setActResult] = useState<ActivityResult>('contacted')
  const [actContact, setActContact] = useState(prospect.contacts?.[0]?.id ?? '')
  const [actNotes, setActNotes] = useState('')
  const [actNext, setActNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const isAdmin = user.role === 'admin'
  const [waContactId, setWaContactId] = useState<string | null>(
    prospect.contacts?.find(c => c.mobile ?? c.phone) ? (prospect.contacts.find(c => c.mobile ?? c.phone)?.id ?? null) : null
  )

  // Max 14 days from today
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 14)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  async function saveActivity() {
    if (!actResult) return
    setSaving(true)
    try {
      const res = await fetch('/api/prospectos/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: prospect.id,
          contact_id:  actContact || null,
          type:        actType,
          result:      actResult,
          notes:       actNotes,
          next_contact: actNext || null,
        }),
      })
      if (res.ok) {
        setActNotes('')
        setActNext('')
        startTransition(() => router.refresh())
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <Link href={`/prospectos/${campaign?.id ?? ''}`}
            className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
            ← Volver a {campaign?.name ?? 'la campaña'}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{prospect.name}</h1>
          <p className="text-sm text-gray-500">{prospect.commune} · {campaign?.name}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${STATUS_COLORS[prospect.status]}`}>
            {STATUS_LABELS[prospect.status]}
          </span>
          <Link href={`/cotizaciones/nueva?prospecto=${prospect.id}&nombre=${encodeURIComponent(prospect.name)}`}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
            style={{ background: '#1B8A4B' }}>
            → Crear Cotización
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Datos generales */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">Datos del Prospecto</div>
            <div className="p-5 grid grid-cols-2 gap-4 text-sm">
              {[
                ['Institución', prospect.name],
                ['Comuna', prospect.commune ?? '—'],
                ['RUT', prospect.rut ?? '—'],
                ['RBD', prospect.rbd ?? '—'],
                ['Dirección', prospect.address ?? '—'],
                ['Ejecutivo asignado', prospect.assigned_name ?? '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-gray-800 font-medium">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contactos */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-sm">Contactos</span>
              <button className="text-xs text-blue-600 hover:underline">+ Agregar</button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {(prospect.contacts ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin contactos registrados</p>
              )}
              {(prospect.contacts ?? []).map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.role ?? '—'} · {c.email ?? 'Sin email'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{c.mobile ?? c.phone ?? '—'}</p>
                    <div className="flex gap-1 mt-1 justify-end">
                      {(c.mobile ?? c.phone) && (
                        <BotonLlamada
                          phoneNumber={c.mobile ?? c.phone ?? ''}
                          contactName={c.name}
                          prospectId={prospect.id}
                          contactId={c.id}
                          onCallLogged={(sid, dur) => {
                            setActType('call')
                            setActResult('contacted')
                            setActContact(c.id)
                            setActNotes(`Llamada ${dur > 0 ? `de ${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')} min` : 'sin respuesta'} · SID: ${sid}`)
                          }}
                        />
                      )}
                      {(c.mobile ?? c.phone) && (
                        <button
                          onClick={() => setWaContactId(waContactId === c.id ? null : c.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded border text-xs cursor-pointer transition-colors ${
                            waContactId === c.id ? 'bg-green-100 border-green-400' : 'border-gray-200 hover:bg-green-50'
                          }`}
                          title="WhatsApp">
                          💬
                        </button>
                      )}
                      <span className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">✉️</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historial */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">
              Historial de gestiones
            </div>
            <div className="p-4 flex flex-col gap-3">
              {(prospect.activities ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Sin gestiones aún</p>
              )}
              {(prospect.activities ?? []).map(a => (
                <div key={a.id} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0">
                    {ACTIVITY_ICONS[a.type]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{ACTIVITY_LABELS[a.type]}</span>
                      {a.result && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {RESULT_LABELS[a.result]}
                        </span>
                      )}
                      {a.duration_sec && (
                        <span className="text-xs text-gray-400">{formatDuration(a.duration_sec)}</span>
                      )}
                    </div>
                    {a.contact_name && (
                      <p className="text-xs text-gray-500 mt-0.5">Con: {a.contact_name}</p>
                    )}
                    {a.notes && <p className="text-sm text-gray-600 mt-1">{a.notes}</p>}
                    {a.next_contact && (
                      <p className="text-xs text-blue-600 mt-1">📅 Próximo: {new Date(a.next_contact).toLocaleDateString('es-CL')}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {a.user_name} · {new Date(a.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side */}
        <div className="flex flex-col gap-4">

          {/* Registrar actividad */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">Registrar Actividad</div>
            <div className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                  <select value={actType} onChange={e => setActType(e.target.value as ActivityType)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none">
                    <option value="call">📞 Llamada</option>
                    <option value="email">✉️ Email</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="note">📝 Nota</option>
                    <option value="visit">🏢 Visita</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Resultado</label>
                  <select value={actResult} onChange={e => setActResult(e.target.value as ActivityResult)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none">
                    {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {(prospect.contacts ?? []).length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Contacto</label>
                  <select value={actContact} onChange={e => setActContact(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none">
                    <option value="">Sin especificar</option>
                    {(prospect.contacts ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.role ?? 'sin cargo'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
                <textarea value={actNotes} onChange={e => setActNotes(e.target.value)}
                  rows={3}
                  placeholder="Qué dijo, qué acordaron, próximo paso..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Próximo contacto <span className="text-gray-400">(máx. 2 semanas)</span>
                </label>
                <input type="date" value={actNext} onChange={e => setActNext(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} max={maxDateStr}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none" />
              </div>

              <button onClick={saveActivity} disabled={saving}
                className="w-full py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-60"
                style={{ background: '#1B8A4B' }}>
                {saving ? 'Guardando...' : 'Guardar gestión'}
              </button>
            </div>
          </div>

          {/* Pipeline */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">Pipeline</div>
            <div className="p-3 flex flex-col gap-1.5">
              {PIPELINE_STEPS.map(step => (
                <div key={step.status}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                    prospect.status === step.status
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-100 text-gray-500'
                  }`}>
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                  {prospect.status === step.status && (
                    <span className="ml-auto text-xs text-blue-500">● Actual</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp */}
          {(() => {
            const waContact = waContactId
              ? prospect.contacts?.find(c => c.id === waContactId)
              : null
            const waPhone = waContact ? (waContact.mobile ?? waContact.phone ?? '') : ''
            if (!waContact || !waPhone) return null
            return (
              <div className="bg-white border border-green-200 rounded-xl overflow-hidden flex flex-col" style={{ height: 420 }}>
                <WhatsAppPanel
                  phone={waPhone}
                  contactName={waContact.name}
                  prospectId={prospect.id}
                  contactId={waContact.id}
                  userName={user.name}
                />
              </div>
            )
          })()}

          {/* Asignación (solo admin) */}
          {isAdmin && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">Asignación</div>
              <div className="p-4">
                <label className="text-xs text-gray-500 block mb-1">Ejecutivo asignado</label>
                <select defaultValue={prospect.assigned_to ?? ''}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none">
                  <option value="">Sin asignar</option>
                  {profiles.filter(p => p.role !== 'coordinador').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {prospect.exception_user_id && (
                  <p className="text-xs text-yellow-600 mt-1.5">
                    ⚠ Excepción individual activa
                    {prospect.exception_reason ? `: ${prospect.exception_reason}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
