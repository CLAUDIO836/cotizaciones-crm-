import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

function buildEmailHtml(opts: {
  clientName: string
  clientEmail: string
  quotationNumber: string
  total: number
  desde: string
  hasta: string
  fechaSalida: string
  cartaUrl: string
  isStaging: boolean
}) {
  const { clientName, clientEmail, quotationNumber, total, desde, hasta, fechaSalida, cartaUrl, isStaging } = opts
  const totalFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(total)

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
  ${isStaging ? `<div style="background:#fbbf24;color:#78350f;padding:8px 16px;font-size:12px;font-weight:700;text-align:center;border-radius:6px;margin-bottom:12px">⚠️ PRUEBA STAGING — Destinatario real sería: ${clientEmail}</div>` : ''}
  <div style="background:#16192A;padding:20px 28px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
    <div style="width:36px;height:36px;border-radius:8px;background:#1B8A4B;display:flex;align-items:center;justify-content:center">
      <span style="color:white;font-weight:900;font-size:16px">T</span>
    </div>
    <div>
      <p style="color:white;font-weight:700;margin:0;font-size:15px">TransCCL</p>
      <p style="color:rgba(255,255,255,0.5);margin:0;font-size:11px">Carta de Aprobación de Servicio</p>
    </div>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px;background:#fff">
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px">Hola ${clientName || 'estimado/a'} 👋</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Tu cotización fue aprobada. Para confirmar el servicio, por favor revisa los detalles y firma la carta de aprobación.</p>

    <div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">Cotización</p>
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827">${quotationNumber}</p>
      ${desde ? `<p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">Ruta</p><p style="margin:0 0 12px;font-size:14px;color:#374151">${desde} → ${hasta || '—'}</p>` : ''}
      ${fechaSalida ? `<p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">Fecha de salida</p><p style="margin:0 0 12px;font-size:14px;color:#374151">${fechaSalida}</p>` : ''}
      <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border:1px solid #86efac;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:#166534">Valor total del servicio</span>
        <span style="font-size:18px;font-weight:800;color:#166534">${totalFmt}</span>
      </div>
    </div>

    <div style="text-align:center;margin:28px 0">
      <a href="${cartaUrl}" style="display:inline-block;background:#1B8A4B;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        📝 Firmar carta de aprobación
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">O copia este link: <a href="${cartaUrl}" style="color:#1B8A4B">${cartaUrl}</a></p>
    </div>

    <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">Firma válida según Ley 19.799 · TransCCL Transportes</p>
    </div>
  </div>
</div>`
}

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
        const html = buildEmailHtml({
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
