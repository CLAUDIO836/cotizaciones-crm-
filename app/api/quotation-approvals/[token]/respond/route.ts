import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { response, responded_name, responded_rut, rejection_reason } = body

  if (!response || !['accepted', 'rejected'].includes(response)) {
    return NextResponse.json({ error: 'response debe ser accepted o rejected' }, { status: 400 })
  }
  if (!responded_name || !responded_rut) {
    return NextResponse.json({ error: 'Nombre y RUT requeridos' }, { status: 400 })
  }
  if (response === 'rejected' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'Debes indicar el motivo del rechazo' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: approval } = await admin
    .from('quotation_approvals')
    .select('*, quotations(id, pipedrive_deal_id)')
    .eq('token', token)
    .single()

  if (!approval) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (approval.response) return NextResponse.json({ error: 'Esta solicitud ya fue respondida' }, { status: 409 })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''
  const respondedAt = new Date().toISOString()

  // Guardar respuesta
  await admin.from('quotation_approvals').update({
    response,
    responded_at: respondedAt,
    responded_name,
    responded_rut,
    responded_ip: ip,
    responded_user_agent: userAgent,
    rejection_reason: rejection_reason ?? null,
  }).eq('token', token)

  const quotationId = approval.quotations?.id
  const dealId = approval.quotations?.pipedrive_deal_id

  // Actualizar estado en CRM
  if (quotationId) {
    await admin.from('quotations').update({
      status: response === 'accepted' ? 'won' : 'lost',
    }).eq('id', quotationId)
  }

  // Actualizar estado en Pipedrive + agregar nota
  if (dealId && PIPEDRIVE_TOKEN) {
    const pipeBody: Record<string, string> = { status: response === 'accepted' ? 'won' : 'lost' }
    if (response === 'rejected' && rejection_reason) {
      pipeBody.lost_reason = rejection_reason
    }
    await fetch(`${PIPEDRIVE_API}/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeBody),
    })

    // Nota en Pipedrive notificando al vendedor
    const fechaHora = new Date(respondedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
    const emoji = response === 'accepted' ? '✅' : '❌'
    const accion = response === 'accepted' ? 'ACEPTADA' : 'RECHAZADA'
    let noteContent = `${emoji} <b>COTIZACIÓN ${accion} POR EL CLIENTE</b><br><br>`
    noteContent += `<b>Nombre:</b> ${responded_name}<br>`
    noteContent += `<b>RUT:</b> ${responded_rut}<br>`
    noteContent += `<b>Fecha/Hora:</b> ${fechaHora}<br>`
    noteContent += `<b>IP:</b> ${ip}<br>`
    if (response === 'rejected' && rejection_reason) {
      noteContent += `<br><b>Motivo del rechazo:</b> ${rejection_reason}`
    }
    if (response === 'accepted') {
      noteContent += `<br><br>👉 El negocio fue marcado como <b>Ganado</b>. Puedes crear la carta de aprobación desde el CRM.`
    }

    await fetch(`${PIPEDRIVE_API}/notes?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteContent, deal_id: Number(dealId) }),
    })
  }

  return NextResponse.json({ ok: true })
}
