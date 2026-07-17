import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { event, data, previous } = body

  // Ignorar eventos que no sean de deals
  if (!event?.startsWith('deal.')) return NextResponse.json({ ok: true })

  const dealId = String(data?.id ?? '')
  if (!dealId) return NextResponse.json({ ok: true })

  const supabase = await createClient()

  // Buscar cotización por pipedrive_deal_id
  const { data: quotation } = await supabase
    .from('quotations')
    .select('id, status')
    .eq('pipedrive_deal_id', dealId)
    .single()

  if (!quotation) return NextResponse.json({ ok: true })

  // Deal ELIMINADO
  if (event === 'deal.deleted') {
    await supabase.from('quotation_items').delete().eq('quotation_id', quotation.id)
    await supabase.from('quotations').delete().eq('id', quotation.id)
    return NextResponse.json({ ok: true, action: 'deleted' })
  }

  // Deal ACTUALIZADO — revisar cambio de status
  if (event === 'deal.updated') {
    const newStatus = data?.status
    const oldStatus = previous?.status

    if (newStatus === oldStatus) return NextResponse.json({ ok: true })

    if (newStatus === 'won') {
      await supabase.from('quotations').update({ status: 'won' }).eq('id', quotation.id)
      return NextResponse.json({ ok: true, action: 'won' })
    }

    if (newStatus === 'lost') {
      await supabase.from('quotations').update({ status: 'lost' }).eq('id', quotation.id)
      return NextResponse.json({ ok: true, action: 'lost' })
    }

    if (newStatus === 'open') {
      await supabase.from('quotations').update({ status: 'open' }).eq('id', quotation.id)
      return NextResponse.json({ ok: true, action: 'reopened' })
    }
  }

  return NextResponse.json({ ok: true })
}
