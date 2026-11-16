import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { client_email, client_phone, client_name, ...quotationBody } = body as {
    client_email?: string
    client_phone?: string
    client_name?: string
    [key: string]: unknown
  }

  // 1. Guardar cotización en staging DB
  const saveRes = await fetch(`${CRM_API_STG}?action=quotations_update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
    body: JSON.stringify(quotationBody),
    cache: 'no-store',
  })
  const saveData = await saveRes.json()
  if (!saveRes.ok) return NextResponse.json(saveData, { status: saveRes.status })

  // 2. Generar carta de aprobación
  let cartaUrl: string | null = null
  try {
    const cartaRes = await fetch(`${CRM_API_STG}?action=letters_create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
      body: JSON.stringify({ quotation_id: quotationBody.id }),
      cache: 'no-store',
    })
    const cartaData = await cartaRes.json()
    const letter = cartaData.data as Record<string, unknown>
    if (letter?.token) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
      cartaUrl = `${baseUrl}/firmar-stg/${letter.token}`
    }
  } catch { /* carta opcional, no bloquea */ }

  // 3. Enviar email via Resend
  // En staging: se envía a ventas@transccl.cl (no al cliente real)
  let emailSent = false
  if (cartaUrl) {
    const resendKey = process.env.RESEND_API_KEY
    const stagingRecipient = 'ventas@transccl.cl'
    const realEmail = client_email?.trim()
    const to = realEmail ? [stagingRecipient] : [stagingRecipient] // staging always to internal

    if (resendKey) {
      try {
        const html = buildQuotationEmailHtml({
          clientName: client_name ?? '',
          clientEmail: realEmail ?? '',
          quotationNumber: (quotationBody.number as string) ?? 'Cotización',
          total: Number(quotationBody.total ?? 0),
          desde: (quotationBody.desde as string) ?? '',
          hasta: (quotationBody.hasta as string) ?? '',
          fechaSalida: (quotationBody.fecha_salida as string) ?? '',
          cartaUrl,
          isStaging: true,
        })
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'CRM Transccl <noreply@transccl.cl>',
            to,
            subject: `[STAGING] Carta de aprobación — ${(quotationBody.number as string) ?? 'Cotización'}`,
            html,
          }),
        })
        emailSent = r.ok
      } catch { /* non-fatal */ }
    }
  }

  // 4. Mensaje WA que Sofía enviaría (staging: simulado, no se envía)
  const realEmail = client_email?.trim()
  const waMessage = client_name || realEmail
    ? `Hola ${client_name ?? ''}! 👋 Te enviamos la carta de aprobación a tu correo ${realEmail ?? ''}. Por favor revísala y fírmala para confirmar tu servicio 📧`
    : null

  return NextResponse.json({ ok: true, cartaUrl, emailSent, waMessage })
}
