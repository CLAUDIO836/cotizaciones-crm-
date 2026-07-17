'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function ContractStatusUpdate({ contractId }: { contractId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: 'expired' | 'cancelled') {
    setLoading(true)
    const { error } = await supabase.from('contracts').update({ status }).eq('id', contractId)
    if (error) {
      toast.error('Error al actualizar estado')
    } else {
      toast.success('Estado actualizado')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="font-semibold text-gray-700 mb-3">Cambiar estado</h3>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="border-gray-300 text-gray-600"
          onClick={() => updateStatus('expired')}
          disabled={loading}
        >
          Marcar como vencido
        </Button>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => updateStatus('cancelled')}
          disabled={loading}
        >
          Cancelar contrato
        </Button>
      </div>
    </div>
  )
}
