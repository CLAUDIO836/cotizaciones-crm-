'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function markWon() {
    // Verificar si el cliente aprobó digitalmente
    const approvalRes = await fetch(`/api/quotation-approvals/by-quotation?quotation_id=${quotationId}`)
    const approvalData = await approvalRes.json()
    const clientApproved = approvalData.approval?.response === 'accepted'

    const confirmMsg = clientApproved
      ? '¿Marcar esta cotización como ganada?'
      : '⚠️ El cliente aún NO ha enviado su aprobación digital.\n\n¿Deseas marcarla como ganada de todas formas?\n\nSe notificará en Pipedrive que fue aprobada manualmente.'

    if (!window.confirm(confirmMsg)) return
    setLoading(true)
    try {
      const { error: e1 } = await supabase.from('quotations').update({ status: 'won' }).eq('id', quotationId)
      if (e1) throw new Error(e1.message)

      await supabase.from('contracts').delete().eq('quotation_id', quotationId)

      const { data: numData, error: e2 } = await supabase.rpc('generate_contract_number')
      if (e2) throw new Error(e2.message)

      const { error: e3 } = await supabase.from('contracts').insert({
        number: numData,
        quotation_id: quotationId,
        client_id: clientId,
        user_id: userId,
        value: total,
        start_date: new Date().toISOString().split('T')[0],
      })
      if (e3) throw new Error(e3.message)

      // Enviar al ERP (no bloquea si falla)
      try {
        const { data: client } = await supabase
          .from('clients')
          .select('name, rut, email, phone, contacto, telefono_fijo, telefono_celular')
          .eq('id', clientId)
          .single()
        await fetch(ERP_IMPORT_URL, {
          method: 'POST',
          headers: { 'x-crm-token': ERP_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigoCRM: quotationId,
            numeroCotizacion: quotationNumber,
            total,
            subtotal: Math.round(total / 1.19),
            ivaPorc: 19,
            clienteRut: client?.rut ?? '',
            clienteNombre: client?.name ?? '',
            clienteEmail: client?.email ?? '',
            clienteTelefono: client?.telefono_celular ?? client?.phone ?? '',
            clienteContacto: client?.contacto ?? '',
          }),
        })
      } catch { /* ERP falla silenciosamente */ }

      // Si no hay aprobación digital, avisar en Pipedrive
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
      const { error } = await supabase.from('quotations').update({ status: 'lost' }).eq('id', quotationId)
      if (error) throw new Error(error.message)
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
      await supabase.from('contracts').delete().eq('quotation_id', quotationId)
      const { error } = await supabase.from('quotations').update({ status: 'open' }).eq('id', quotationId)
      if (error) throw new Error(error.message)
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
