'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'

interface Props {
  quotationId: string
  quotationNumber: string
  clientId: string
  userId: string
  total: number
  status: string
  inline?: boolean
}

const ERP_IMPORT_URL = process.env.NEXT_PUBLIC_ERP_IMPORT_URL ?? 'https://erp.transccl.cl/api/crm-import'
const ERP_TOKEN      = process.env.NEXT_PUBLIC_CRM_SYNC_TOKEN ?? ''

export default function StatusActions({ quotationId, quotationNumber, clientId, userId, total, status, inline }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setStatus(newStatus: string) {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'set_status', id: quotationId, status: newStatus }),
    })
    if (!res.ok) throw new Error('Error')
  }

  async function markWon() {
    const approvalRes = await fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
    const approvalData = await approvalRes.json()
    const clientApproved = approvalData.approval?.response === 'accepted'

    const confirmMsg = clientApproved
      ? '¿Marcar esta cotización como ganada?'
      : '⚠️ El cliente aún NO ha enviado su aprobación digital.\n\n¿Deseas marcarla como ganada de todas formas?'

    if (!window.confirm(confirmMsg)) return
    setLoading(true)
    try {
      await setStatus('won')
      // Create contract via API
      await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'create_contract',
          quotation_id: quotationId,
          client_id: clientId,
          user_id: userId,
          value: total,
        }),
      })
      if (!clientApproved) {
        try {
          await fetch('/api/quotation-approvals/notify-manual-win', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quotation_id: quotationId }),
          })
        } catch { /* no bloquea */ }
      }
      toast.success('¡Cotización ganada!')
      router.refresh()
    } catch (err) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  async function markLost() {
    if (!window.confirm('¿Marcar esta cotización como perdida?')) return
    setLoading(true)
    try {
      await setStatus('lost')
      toast.success('Cotización marcada como perdida')
      router.refresh()
    } catch (err) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  async function reopen() {
    if (!window.confirm('¿Reabrir esta cotización?')) return
    setLoading(true)
    try {
      await setStatus('open')
      toast.success('Cotización reabierta')
      router.refresh()
    } catch (err) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  if (status === 'won' || status === 'lost') {
    return (
      <Button variant="outline" size="sm" onClick={reopen} disabled={loading}>
        <RotateCcw className="w-4 h-4 mr-1.5" />
        {loading ? 'Reabriendo...' : 'Reabrir'}
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        style={{ background: '#1B8A4B' }}
        className="text-white font-semibold"
        onClick={markWon}
        disabled={loading}
      >
        <CheckCircle className="w-4 h-4 mr-1.5" />
        Ganado
      </Button>
      <Button
        size="sm"
        style={{ background: '#D33A2C' }}
        className="text-white font-semibold"
        onClick={markLost}
        disabled={loading}
      >
        <XCircle className="w-4 h-4 mr-1.5" />
        Perdido
      </Button>
    </div>
  )
}
