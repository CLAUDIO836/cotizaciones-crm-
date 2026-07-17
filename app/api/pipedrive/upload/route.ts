import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationPDF } from '@/lib/pdf/generate'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API   = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  if (!PIPEDRIVE_TOKEN) {
    return NextResponse.json({ error: 'PIPEDRIVE_API_TOKEN no configurado' }, { status: 500 })
  }

  const { quotationId, pipelineId, fechaSalida } = await req.json()
  if (!quotationId) {
    return NextResponse.json({ error: 'Falta quotationId' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: q } = await supabase
    .from('quotations')
    .select(`*, clients(name, rut, email, address), profiles(name, email), quotation_items(description, quantity, unit_price, subtotal, sort_order)`)
    .eq('id', quotationId)
    .single()

  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  // Mapeo email CRM → user_id Pipedrive
  const PIPEDRIVE_USERS: Record<string, number> = {
    'claudio@transccl.cl':        563196,
    'ventas@transccl.cl':         2008020,
    'ecomercial1@transccl.cl':    563218,
    'ecomercial2@transccl.cl':    563943,
    'ecomercial3@transccl.cl':    2386983,
    'ecomercial4@transccl.cl':    15372325,
    'ecomercial5@transccl.cl':    15372314,
    'ecomercial6@transccl.cl':    15372336,
    'clsaldivia@transportesklaus.cl': 572704,
  }

  const vendedorEmail = q.profiles?.email ?? ''
  const pipedriveUserId = PIPEDRIVE_USERS[vendedorEmail]

  // Crear negocio en Pipedrive
  const dealBody: Record<string, unknown> = {
    title: `COT-${q.number} - ${q.clients?.name ?? 'Sin cliente'}`,
    value: q.total ?? 0,
    currency: 'CLP',
  }
  if (pipedriveUserId) dealBody.user_id = pipedriveUserId
  if (pipelineId) dealBody.pipeline_id = Number(pipelineId)
  if (fechaSalida) dealBody.expected_close_date = fechaSalida.slice(0, 10)

  const dealRes = await fetch(`${PIPEDRIVE_API}/deals?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dealBody),
  })
  const dealJson = await dealRes.json()
  const dealId = dealJson.data?.id

  if (!dealId) {
    return NextResponse.json({ error: 'Error creando negocio en Pipedrive', detail: dealJson }, { status: 500 })
  }

  // Guardar deal ID y actualizar número de cotización con el ID del negocio
  await supabase.from('quotations').update({
    pipedrive_deal_id: String(dealId),
    number: String(dealId),
  }).eq('id', quotationId)

  const items = (q.quotation_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfElement = React.createElement(QuotationPDF as any, {
    data: {
      number: q.number,
      status: q.status,
      issue_date: q.issue_date,
      expiry_date: q.expiry_date,
      subtotal: q.subtotal,
      tax_pct: q.tax_pct,
      total: q.total,
      notes: q.notes,
      terms: q.terms,
      client: q.clients,
      vendedor: q.profiles,
      items,
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(pdfElement as any)

  // Subir archivo a Pipedrive
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `COT-${q.number}.pdf`)
  formData.append('deal_id', String(dealId))

  const res = await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    body: formData,
  })

  const result = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: 'Error subiendo a Pipedrive', detail: result }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dealId, fileId: result.data?.id })
}
