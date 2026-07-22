'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  quotationId: string
  pipelineId?: string
  fechaSalida?: string
  companyName?: string
  desde?: string
  hasta?: string
  pipedriveDealId?: string
}

export default function ResyncButton({ quotationId, pipelineId, fechaSalida, companyName, desde, hasta, pipedriveDealId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleResync() {
    setLoading(true)
    try {
      const res = await fetch('/api/pipedrive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationId,
          pipelineId: pipelineId || null,
          fechaSalida: fechaSalida || null,
          companyName: companyName || null,
          desde: desde || null,
          hasta: hasta || null,
          resync: true,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(pipedriveDealId
          ? `PDF re-subido al negocio #${json.dealId ?? pipedriveDealId} en Pipedrive`
          : `Negocio #${json.dealId} creado en Pipedrive`)
      } else {
        toast.error(json.error ?? 'Error al sincronizar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleResync} disabled={loading}>
      <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Sincronizando...' : 'Re-sincronizar Pipedrive'}
    </Button>
  )
}
