'use client'

import { useState, useEffect } from 'react'
import { Send, Copy, Check, ExternalLink, Trash2, AlertTriangle, Clock, CheckCircle2, XCircle, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Approval {
  id: string
  token: string
  response: 'accepted' | 'rejected' | null
  responded_at: string | null
  responded_name: string | null
  rejection_reason: string | null
  created_at: string
}

export default function QuotationApprovalButton({ quotationId, wonMode = false }: { quotationId: string; wonMode?: boolean }) {
  const [approval, setApproval] = useState<Approval | null | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
      .then(r => r.json())
      .then(d => setApproval(d.approval ?? null))
      .catch(() => setApproval(null))
  }, [quotationId])

  const url = approval ? `${window.location.origin}/aprobar/${approval.token}` : ''

  async function generate() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/quotation-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotation_id: quotationId }),
    })
    setGenerating(false)
    if (res.ok) {
      const r = await fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
      const d = await r.json()
      setApproval(d.approval ?? null)
    } else {
      const d = await res.json()
      if (d.error === 'already_exists') {
        const r = await fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
        const dd = await r.json()
        setApproval(dd.approval ?? null)
      } else {
        setError(d.error ?? 'Error al generar link')
      }
    }
  }

  async function deleteFn() {
    if (!approval) return
    setDeleting(true)
    const res = await fetch(`/api/quotation-approvals/${approval.token}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { setApproval(null); setShowConfirmDelete(false) }
    else setError('Error al eliminar')
  }

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (approval === undefined) return <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-lg" />

  // Modo wonMode: cotización ya ganada, solo mostrar estado de aprobación
  if (wonMode) {
    if (!approval || approval.response !== 'accepted') {
      return (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sin aprobación digital del cliente</p>
          </div>
          <p className="text-xs text-amber-600 mb-3">
            {!approval
              ? 'Esta cotización fue ganada manualmente. El cliente no ha firmado su aprobación digital.'
              : 'El cliente tiene una solicitud de aprobación pendiente de responder.'}
          </p>
          {approval && (
            <div className="flex items-center gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Ver link del cliente
                </Button>
              </a>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700" onClick={copy}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          )}
        </div>
      )
    }
    // Aprobada digitalmente — no mostrar nada (flujo correcto)
    return null
  }

  if (!approval) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
          <Send className="w-4 h-4 mr-1.5" />
          {generating ? 'Generando...' : 'Enviar para aprobación'}
        </Button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  const isAccepted = approval.response === 'accepted'
  const isRejected = approval.response === 'rejected'
  const isPending = !approval.response

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
          style={isAccepted
            ? { background: '#dcfce7', color: '#166534' }
            : isRejected
              ? { background: '#fee2e2', color: '#991b1b' }
              : { background: '#fef9c3', color: '#854d0e' }
          }
        >
          {isAccepted && <><CheckCircle2 className="w-3.5 h-3.5" /> Aceptada</>}
          {isRejected && <><XCircle className="w-3.5 h-3.5" /> Rechazada</>}
          {isPending && <><Clock className="w-3.5 h-3.5" /> Pendiente respuesta</>}
        </div>

        {isPending && (
          <Button variant="outline" size="sm" onClick={copy} title="Copiar link">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" title="Abrir página">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>

        {/* Eliminar solo si pendiente */}
        {isPending && !showConfirmDelete && (
          <Button variant="outline" size="sm" onClick={() => setShowConfirmDelete(true)} disabled={deleting}
            className="text-red-500 hover:text-red-700 hover:border-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        {isPending && showConfirmDelete && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-700 font-medium">¿Eliminar?</span>
            <button onClick={deleteFn} disabled={deleting} className="text-xs font-bold text-red-700 hover:underline ml-1">{deleting ? '...' : 'Sí'}</button>
            <button onClick={() => setShowConfirmDelete(false)} className="text-xs text-gray-500 hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Info */}
      {isPending && <p className="text-xs text-gray-400 ml-0.5">Enviada {new Date(approval.created_at).toLocaleString('es-CL')} · esperando respuesta del cliente</p>}
      {isAccepted && <p className="text-xs text-gray-400 ml-0.5">Aceptada por <strong className="text-gray-600">{approval.responded_name}</strong> · {new Date(approval.responded_at!).toLocaleString('es-CL')}</p>}
      {isRejected && (
        <div>
          <p className="text-xs text-gray-400 ml-0.5">Rechazada por <strong className="text-gray-600">{approval.responded_name}</strong> · {new Date(approval.responded_at!).toLocaleString('es-CL')}</p>
          {approval.rejection_reason && <p className="text-xs text-red-500 ml-0.5 mt-0.5">Motivo: {approval.rejection_reason}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
