import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { sendViaGmail } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: quotationId } = await params
  const b = await req.json()
  const to: string      = (b.to ?? '').trim()
  const subject: string = (b.subject ?? '').trim()
  const html: string    = b.html ?? ''
  const threadId: string | undefined = b.thread_id ?? undefined

  if (!to || !subject || !html)
    return NextResponse.json({ error: 'Faltan campos: to, subject, html' }, { status: 400 })

  // Datos del vendedor asignado al negocio
  const gtRes = await fetch(
    `${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  )
  const gtData = await gtRes.json()
  const refreshToken: string = gtData?.data?.refresh_token ?? ''
  const vendorEmail: string  = gtData?.data?.email ?? ''
  const vendorName:  string  = gtData?.data?.name  ?? 'TransCCL'

  if (!refreshToken)
    return NextResponse.json({ error: 'El ejecutivo no tiene Gmail conectado' }, { status: 400 })

  // Enviar vía Gmail API
  const { messageId, threadId: returnedThreadId } = await sendViaGmail({
    refreshToken,
    from:    `${vendorName} <${vendorEmail}>`,
    to,
    subject,
    html,
    threadId,
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
}
