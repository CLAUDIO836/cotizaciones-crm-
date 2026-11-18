import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { sendViaGmail, type MailAttachment } from '@/lib/gmail'
import { htmlToPdf } from '@/lib/pdf/html-to-pdf'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id: quotationId } = await params
    const b = await req.json()
    const to: string        = (b.to ?? '').trim()
    const subject: string   = (b.subject ?? '').trim()
    const html: string      = b.html ?? ''
    const threadId: string | undefined = b.thread_id ?? undefined
    const attachPdf: boolean = b.attachPdf ?? false

    if (!to || !subject || !html)
      return NextResponse.json({ error: 'Faltan campos: to, subject, html' }, { status: 400 })

    // Datos del vendedor asignado al negocio
    const gtUrl = `${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`
    const gtRes = await fetch(gtUrl, { cache: 'no-store' })
    const gtRaw = await gtRes.text()
    let gtData: Record<string, unknown>
    try {
      gtData = JSON.parse(gtRaw)
    } catch {
      return NextResponse.json({ error: `crm-api error: ${gtRaw.slice(0, 200)}` }, { status: 500 })
    }
    const data = (gtData?.data ?? {}) as Record<string, string>
    const refreshToken: string = data.refresh_token ?? ''
    const vendorEmail: string  = data.email ?? ''
    const vendorName:  string  = data.name  ?? 'TransCCL'

    if (!refreshToken)
      return NextResponse.json({ error: 'El ejecutivo no tiene Gmail conectado. Conecta tu Gmail en la configuración de tu perfil.' }, { status: 400 })

    // Adjunto PDF si se solicitó
    const attachments: MailAttachment[] = []
    if (attachPdf) {
      try {
        const appUrl  = process.env.APP_URL ?? req.nextUrl.origin
        const htmlUrl = `${appUrl}/api/cotizaciones/${quotationId}/propuesta?token=${encodeURIComponent(token)}`
        const pdfBuf  = await htmlToPdf(htmlUrl)
        // Obtener número de cotización para el nombre del archivo
        const qRes = await fetch(`${CRM_API}?action=quotations_get&id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const qData = await qRes.json()
        const quoteNum = (qData?.data ?? qData?.quotation ?? {}).number ?? quotationId.slice(0, 8)
        attachments.push({ filename: `cotizacion-${quoteNum}.pdf`, contentType: 'application/pdf', data: Buffer.from(pdfBuf) })
      } catch (pdfErr) {
        console.error('[compose-email] PDF attach error:', pdfErr)
      }
    }

    // Enviar vía Gmail API
    const { messageId, threadId: returnedThreadId } = await sendViaGmail({
      refreshToken,
      from:    `${vendorName} <${vendorEmail}>`,
      to,
      subject,
      html,
      threadId,
      attachments: attachments.length ? attachments : undefined,
    })

    // Guardar registro en BD
    await fetch(`${CRM_API}?action=emails_save&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotation_id:    quotationId,
        gmail_message_id: messageId,
        gmail_thread_id:  returnedThreadId,
        from_email:       vendorEmail,
        to_email:         to,
        subject,
        body_html:        html,
      }),
    })

    return NextResponse.json({ ok: true, message_id: messageId, thread_id: returnedThreadId })
  } catch (e) {
    console.error('[compose-email]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
