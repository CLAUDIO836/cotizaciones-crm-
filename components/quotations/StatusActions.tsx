'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, RotateCcw, Upload } from 'lucide-react'
import BillingModal from './BillingModal'

interface Props {
  quotationId: string
  quotationNumber: string
  clientId: string
  userId: string
  total: number
  status: string
  pipedriveDealId?: string
  inline?: boolean
  btnWidth?: number
  // billing pre-fill
  billingName?: string
  billingRut?:  string
  billingAddr?: string
}

const ERP_IMPORT_URL = process.env.NEXT_PUBLIC_ERP_IMPORT_URL ?? 'https://erp.transccl.cl/api/crm-import'
const ERP_TOKEN      = process.env.NEXT_PUBLIC_CRM_SYNC_TOKEN ?? ''

export default function StatusActions({ quotationId, quotationNumber, clientId, userId, total, status, pipedriveDealId, inline, btnWidth, billingName = '', billingRut = '', billingAddr = '' }: Props) {
  const router = useRouter()
  const [loading,       setLoading]       = useState(false)
  const [showBilling,   setShowBilling]   = useState(false)

  async function setStatus(newStatus: string) {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'set_status', id: quotationId, status: newStatus, pipedrive_deal_id: pipedriveDealId }),
    })
    if (!res.ok) throw new Error('Error')
  }

  async function markWon() {
    // Open billing modal instead of window.confirm
    setShowBilling(true)
  }

  async function finalizarWon() {
    setShowBilling(false)
    setLoading(true)
    try {
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
      // Notify manual win if no digital approval
      try {
        const approvalRes  = await fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
        const approvalData = await approvalRes.json()
        if (approvalData.approval?.response !== 'accepted') {
          await fetch('/api/quotation-approvals/notify-manual-win', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quotation_id: quotationId }),
          })
        }
      } catch { /* no bloquea */ }
      toast.success('¡Negocio ganado! Solicitud enviada a contabilidad.')
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
      <>
        {showBilling && (
          <BillingModal
            quotationId={quotationId}
            billingName={billingName}
            billingRut={billingRut}
            billingAddr={billingAddr}
            alreadyWon
            onSuccess={() => { setShowBilling(false); router.refresh() }}
            onClose={() => setShowBilling(false)}
          />
        )}
        <div className="flex gap-2">
          {status === 'won' && (
            <Button variant="outline" size="sm" onClick={() => setShowBilling(true)} disabled={loading}>
              <Upload className="w-4 h-4 mr-1.5" />
              Comprobantes
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={reopen} disabled={loading}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {loading ? 'Reabriendo...' : 'Reabrir'}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {showBilling && (
        <BillingModal
          quotationId={quotationId}
          billingName={billingName}
          billingRut={billingRut}
          billingAddr={billingAddr}
          onSuccess={finalizarWon}
          onClose={() => setShowBilling(false)}
        />
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          style={{ background: '#1B8A4B', ...(btnWidth ? { width: btnWidth } : {}) }}
          className="text-white font-semibold"
          onClick={markWon}
          disabled={loading}
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Ganado
        </Button>
        <Button
          size="sm"
          style={{ background: '#D33A2C', ...(btnWidth ? { width: btnWidth } : {}) }}
          className="text-white font-semibold"
          onClick={markLost}
          disabled={loading}
        >
          <XCircle className="w-4 h-4 mr-1.5" />
          Perdido
        </Button>
      </div>
    </>
  )
}

