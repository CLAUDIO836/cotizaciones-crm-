import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

// Mapeo nombre de etapa Pipedrive → etapa CRM
function mapStageName(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('lead') || n.includes('prospecto')) return 'lead'
  if (n.includes('contact')) return 'contactado'
  if (n.includes('cotiz') || n.includes('propuesta') || n.includes('quot')) return 'cotizacion'
  if (n.includes('negoci') || n.includes('negocia')) return 'negociacion'
  if (n.includes('cierr') || n.includes('close')) return 'cierre'
  return 'lead'
}

async function getStageName(stageId: number): Promise<string | null> {
  if (!PIPEDRIVE_TOKEN || !stageId) return null
  try {
    const res = await fetch(`${PIPEDRIVE_API}/stages/${stageId}?api_token=${PIPEDRIVE_TOKEN}`)
    const json = await res.json()
    return json.data?.name ?? null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { event, data, previous } = body

  if (!event?.startsWith('deal.')) return NextResponse.json({ ok: true })

  const dealId = String(data?.id ?? '')
  if (!dealId) return NextResponse.json({ ok: true })

  const supabase = await createClient()

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

  // Deal ACTUALIZADO — sincronizar todo lo que cambió
  if (event === 'deal.updated') {
    const updates: Record<string, unknown> = {}

    // Estado (ganado/perdido/abierto)
    const newStatus = data?.status
    const oldStatus = previous?.status
    if (newStatus && newStatus !== oldStatus) {
      if (newStatus === 'won') updates.status = 'won'
      else if (newStatus === 'lost') updates.status = 'lost'
      else if (newStatus === 'open') updates.status = 'open'
    }

    // Valor del negocio → total
    if (data?.value !== undefined && data.value !== previous?.value) {
      updates.total = data.value
      updates.subtotal = data.value
    }

    // Etapa → mapear nombre de etapa Pipedrive a etapa CRM
    const newStageId = data?.stage_id
    const oldStageId = previous?.stage_id
    if (newStageId && newStageId !== oldStageId) {
      const stageName = await getStageName(newStageId)
      if (stageName) updates.etapa = mapStageName(stageName)
    }

    // Pipeline
    const newPipelineId = data?.pipeline_id
    const oldPipelineId = previous?.pipeline_id
    if (newPipelineId && newPipelineId !== oldPipelineId) {
      updates.pipeline_id = String(newPipelineId)
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('quotations').update(updates).eq('id', quotation.id)
    }

    return NextResponse.json({ ok: true, action: 'updated', updates })
  }

  return NextResponse.json({ ok: true })
}
