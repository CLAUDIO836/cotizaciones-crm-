import { NextRequest, NextResponse } from 'next/server'
import { getToken, fetchPipelines } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'
import { sendViaGmail } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: quotationId } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin

  try {
    // 1. Carta existente (o crear si no hay)
    const lettersRes = await fetch(`${CRM_API}?action=letters_by_quotation&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const lettersData = await lettersRes.json()
    let cartaUrl: string | null = null

    const letters: Array<{ token: string }> = lettersData?.letters ?? lettersData?.data ?? []
    if (letters.length > 0) {
      cartaUrl = `${baseUrl}/firmar/${letters[0].token}`
    } else {
      // Crear carta si no existe
      const cartaRes = await fetch(`${CRM_API}?action=letters_create&token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotation_id: quotationId }),
        cache: 'no-store',
      })
      const cartaData = await cartaRes.json()
      if (cartaData?.data?.token) cartaUrl = `${baseUrl}/firmar/${cartaData.data.token}`
    }

    if (!cartaUrl) return NextResponse.json({ error: 'No se pudo obtener carta de aprobación' }, { status: 500 })

    // 2. Datos del vendedor asignado + Gmail token
    const gtRes = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const gtData = await gtRes.json()
    const vendorRefreshToken: string = gtData?.data?.refresh_token ?? ''
    const vendorEmail: string        = gtData?.data?.email   ?? 'ventas@transccl.cl'
    const vendorName:  string        = gtData?.data?.name    ?? 'TransCCL Ventas'
    const vendorPhone: string        = gtData?.data?.celular ?? '+56 2 2945 5713'

    // 3. Datos del cliente (cotización + carta para email)
    const qRes = await fetch(`${CRM_API}?action=quotations_get&id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const qData = await qRes.json()
    const q = qData?.data ?? qData?.quotation ?? {}
    const quoteNumber: string = String(q.number ?? q.pipedrive_deal_id ?? quotationId.slice(0, 8))
    const total:       number = Number(q.total ?? 0)

    // Email del cliente: desde cotización o desde la carta de aprobación
    let clientEmail: string = q.contact_email ?? q.client_email ?? ''
    let clientName:  string = q.contact_name  ?? q.client_name  ?? ''
    if (!clientEmail && letters.length > 0) {
      const l = letters[0] as Record<string, string>
      clientEmail = l.client_email ?? ''
      clientName  = clientName || l.client_name || ''
    }

    if (!clientEmail) return NextResponse.json({ error: 'La cotización no tiene email de contacto' }, { status: 400 })

    const cartaToken = letters.length > 0 ? (letters[0] as Record<string, string>).token : cartaUrl.split('/firmar/')[1] ?? ''
    const pipelines = await fetchPipelines()
    const pipeline = pipelines.find(p => p.id === String(q.pipeline_id ?? '')) ?? null
    const pipelineName = ((pipeline?.name ?? q.pipeline_name ?? '') as string).toLowerCase()
    const isDiario = pipelineName.includes('diario')

    let propuestaUrl: string | undefined
    if (isDiario) {
      cartaUrl = cartaToken
        ? `${baseUrl}/api/cotizaciones/${quotationId}/propuesta?token=${cartaToken}`
        : `${baseUrl}/api/cotizaciones/${quotationId}/propuesta`
      propuestaUrl = undefined
    } else {
      propuestaUrl = cartaToken ? `${baseUrl}/api/cotizaciones/${quotationId}/html?token=${cartaToken}` : undefined
    }

    const html = buildQuotationEmailHtml({
      clientName, clientEmail, quotationNumber: quoteNumber,
      total, desde: q.desde ?? '', hasta: q.hasta ?? '',
      fechaSalida: q.fecha_salida ?? '', cartaUrl, propuestaUrl,
      vendorName, vendorEmail, vendorPhone,
    })

    let sentFrom = vendorEmail
    let messageId = ''
    let threadId = ''

    const subject = `Tu cotización de TransCCL está lista — ${quoteNumber}`

    if (vendorRefreshToken) {
      const result = await sendViaGmail({
        refreshToken: vendorRefreshToken,
        from:    `${vendorName} <${vendorEmail}>`,
        to:      clientEmail,
        bcc:     `crm+negocio${quoteNumber}@transccl.cl`,
        subject,
        html,
      })
      messageId = result.messageId
      threadId  = result.threadId
    } else {
      const resendKey = process.env.RESEND_API_KEY
      if (!resendKey) return NextResponse.json({ error: 'Sin método de envío configurado' }, { status: 500 })
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'TransCCL Ventas <ventas@transccl.cl>',
          to:      [clientEmail],
          subject,
          html,
        }),
      })
      sentFrom = 'ventas@transccl.cl'
    }

    // Registrar correo enviado en la BD del CRM
    await fetch(`${CRM_API}?action=emails_save&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotation_id:     quotationId,
        gmail_message_id: messageId,
        gmail_thread_id:  threadId,
        from_email:       sentFrom,
        to_email:         clientEmail,
        subject,
        body_html:        html,
      }),
    }).catch(() => { /* no bloquea si falla el registro */ })

    return NextResponse.json({ ok: true, sent_to: clientEmail, sent_from: sentFrom, carta_url: cartaUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
