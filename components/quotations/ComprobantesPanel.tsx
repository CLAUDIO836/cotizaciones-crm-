'use client'

import { useState, useEffect, useCallback } from 'react'

interface Comprobante {
  id: string
  letter_token: string
  tipo: string
  filename: string
  content_type: string
  uploaded_at: string
  amount: number | null
  validation_status: 'pending' | 'vendedor_ok' | 'approved' | 'rejected'
  vendedor_ok_by: string | null
  vendedor_ok_at: string | null
  superadmin_ok_by: string | null
  superadmin_ok_at: string | null
  rejection_reason: string | null
  rejected_by: string | null
  rejected_at: string | null
  vok_name: string | null
  sadm_name: string | null
  rej_name: string | null
}

function utcToChile(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

const TIPO_LABEL: Record<string, string> = {
  abono1: '1er abono (50%)',
  abono2: '2do abono (50%)',
  total: 'Pago total',
}

export default function ComprobantesPanel({ quotationId, userRole }: { quotationId: string; userRole: string }) {
  const [items, setItems] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const isSuperAdmin = userRole === 'superadmin' || userRole === 'gerencia' || userRole === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/comprobantes?quotation_id=${quotationId}`)
      const d = await r.json()
      setItems(d.data ?? [])
    } catch {
      setError('Error al cargar comprobantes')
    } finally {
      setLoading(false)
    }
  }, [quotationId])

  useEffect(() => { load() }, [load])

  async function validate(id: string, level: 'vendedor' | 'superadmin') {
    setWorking(id + level)
    try {
      const r = await fetch('/api/comprobantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, level }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Error') }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al validar')
    } finally {
      setWorking(null)
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { alert('Escribe el motivo de rechazo'); return }
    setWorking(id + 'reject')
    try {
      const r = await fetch('/api/comprobantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'reject', id, reason: rejectReason }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Error') }
      setRejectId(null)
      setRejectReason('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al rechazar')
    } finally {
      setWorking(null)
    }
  }

  if (loading) return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>

  // Global banner
  const allApproved = items.length > 0 && items.every(c => c.validation_status === 'approved')
  const anyRejected = items.some(c => c.validation_status === 'rejected')

  const banner = items.length === 0
    ? { bg: '#f9fafb', border: '#e5e7eb', text: 'Sin comprobantes subidos aún por el cliente.', icon: '📂' }
    : allApproved
      ? { bg: '#f0fdf4', border: '#86efac', text: '✅ Pago completamente validado — listo para facturar', icon: '' }
      : anyRejected
        ? { bg: '#fef2f2', border: '#fca5a5', text: '❌ Hay comprobantes rechazados — cliente notificado por correo', icon: '' }
        : { bg: '#fffbeb', border: '#fde68a', text: '⏳ Validación en curso', icon: '' }

  return (
    <div className="space-y-4">
      {/* Global banner */}
      <div className="rounded-xl border p-3 text-sm font-medium"
        style={{ background: banner.bg, borderColor: banner.border }}>
        {banner.icon} {banner.text}
      </div>

      {items.length > 0 && (
        <div className="flex justify-end">
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 underline">Actualizar</button>
        </div>
      )}

      {items.map(c => {
        const isImg = c.content_type.startsWith('image/')
        const fileIcon = isImg ? '🖼' : '📄'
        const viewUrl = `/api/comprobantes/download?id=${c.id}`
        const dlUrl   = `/api/comprobantes/download?id=${c.id}&download=1`
        const busy    = working === c.id + 'vendedor' || working === c.id + 'superadmin' || working === c.id + 'reject'

        const statusBadge = {
          pending:     { bg: '#fef9c3', color: '#854d0e', border: '#fde68a', label: '🟡 Pendiente validación' },
          vendedor_ok: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: '🔵 Vendedor OK · esperando Superadmin' },
          approved:    { bg: '#f0fdf4', color: '#166534', border: '#86efac', label: '✅ PAGADO — validado' },
          rejected:    { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: '❌ Rechazado' },
        }[c.validation_status]

        return (
          <div key={c.id} className="rounded-xl border bg-white overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">{fileIcon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {TIPO_LABEL[c.tipo] ?? c.tipo}
                    {c.amount ? <span className="ml-2 text-green-700 font-bold">{formatCLP(c.amount)}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{c.filename} · {utcToChile(c.uploaded_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-1 text-xs rounded-lg border font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  👁 Ver
                </a>
                <a href={dlUrl}
                  className="px-2 py-1 text-xs rounded-lg border font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  ⬇ Descargar
                </a>
              </div>
            </div>

            {/* Status + actions */}
            <div className="px-4 py-3 space-y-2">
              {/* Status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}` }}>
                  {statusBadge.label}
                </span>
                {c.validation_status === 'vendedor_ok' && c.vok_name && (
                  <span className="text-xs text-gray-400">por {c.vok_name} · {c.vendedor_ok_at ? utcToChile(c.vendedor_ok_at) : ''}</span>
                )}
                {c.validation_status === 'approved' && (
                  <>
                    {c.vok_name && <span className="text-xs text-green-600">✓ {c.vok_name}</span>}
                    {c.sadm_name && <span className="text-xs text-green-600">✓ {c.sadm_name}</span>}
                  </>
                )}
                {c.validation_status === 'rejected' && c.rejection_reason && (
                  <span className="text-xs text-red-500 italic">"{c.rejection_reason}"</span>
                )}
                {c.validation_status === 'rejected' && c.rej_name && (
                  <span className="text-xs text-gray-400">por {c.rej_name} · {c.rejected_at ? utcToChile(c.rejected_at) : ''}</span>
                )}
              </div>

              {/* Action buttons */}
              {c.validation_status !== 'approved' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {c.validation_status === 'pending' && (
                    <button
                      onClick={() => validate(c.id, 'vendedor')}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: '#2563eb' }}>
                      {busy ? '...' : '✓ Validar — Vendedor'}
                    </button>
                  )}
                  {c.validation_status === 'vendedor_ok' && isSuperAdmin && (
                    <button
                      onClick={() => validate(c.id, 'superadmin')}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: '#16a34a' }}>
                      {busy ? '...' : '✓ Validar con banco — Superadmin'}
                    </button>
                  )}
                  {(c.validation_status === 'pending' || c.validation_status === 'vendedor_ok') && isSuperAdmin && (
                    <button
                      onClick={() => { setRejectId(c.id); setRejectReason('') }}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors disabled:opacity-50"
                      style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fff' }}>
                      ✕ Rechazar
                    </button>
                  )}
                </div>
              )}

              {/* Reject form */}
              {rejectId === c.id && (
                <div className="mt-2 space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700">Motivo del rechazo (se enviará al cliente por correo)</p>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Ej: El monto no coincide, imagen ilegible..."
                    className="w-full text-xs p-2 border border-red-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(c.id)}
                      disabled={!!working}
                      className="px-3 py-1.5 text-xs rounded-lg font-semibold text-white disabled:opacity-50"
                      style={{ background: '#dc2626' }}>
                      {working === c.id + 'reject' ? '...' : 'Confirmar rechazo'}
                    </button>
                    <button
                      onClick={() => setRejectId(null)}
                      className="px-3 py-1.5 text-xs rounded-lg border font-medium text-gray-500">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
