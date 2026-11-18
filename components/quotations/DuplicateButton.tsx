'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DuplicateButton({ quotationId }: { quotationId: string }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function duplicate() {
    if (!confirm('¿Duplicar este negocio? Se creará uno nuevo en estado Abierto con los mismos datos (sin fecha de servicio).')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quotations/${quotationId}/duplicate`, { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error al duplicar')
      toast.success('Negocio duplicado')
      router.push(`/cotizaciones/${d.id}`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={duplicate} disabled={loading} className="text-xs h-7 px-2.5">
      <Copy className="w-3 h-3 mr-1" />
      {loading ? 'Duplicando...' : 'Duplicar'}
    </Button>
  )
}
