'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function DeleteButton({ quotationId, pipedriveDealId }: { quotationId: string; pipedriveDealId?: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'delete', id: quotationId, pipedrive_deal_id: pipedriveDealId }),
    })
    if (!res.ok) { toast.error('Error al eliminar'); setLoading(false); return }
    toast.success('Cotización eliminada')
    router.push('/cotizaciones')
  }

  if (confirming) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-sm text-red-600 font-medium">¿Eliminar?</span>
        <Button variant="destructive" size="sm" disabled={loading} onClick={handleDelete}>
          {loading ? 'Eliminando...' : 'Sí, eliminar'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancelar</Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:border-red-300"
      onClick={() => setConfirming(true)}>
      <Trash2 className="w-4 h-4 mr-1.5" />
      Eliminar
    </Button>
  )
}
