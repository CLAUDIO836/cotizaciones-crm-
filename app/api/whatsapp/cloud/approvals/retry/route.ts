import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { conv_id, quotation_id, send_email } = await req.json()
    if (!conv_id) return NextResponse.json({ error: 'conv_id requerido' }, { status: 400 })

    const tokenParam = `&token=${encodeURIComponent(token)}`
    let emailSent = false
    let cartaUrl: string | null = null

    // Enviar email si se solicita y hay quotation_id
    if (send_email && quotation_id) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
      const resendKey = process.env.RESEND_API_KEY

      // Obtener/crear carta
      try {
        const cartaRes = await fetch(`${CRM_API}?action=letters_create${tokenParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quotation_id }),
          cache: 'no-store',
        })
        const cartaData = await cartaRes.json()
        if (cartaData?.data?.token) cartaUrl = `${baseUrl}/firmar/${cartaData.data.token}`
      } catch { /* non-fatal */ }

      // Obtener detalles del approval para el email
      if (cartaUrl && resendKey) {
        try {
          const apRes = await fetch(`${CRM_API}?action=wa_approvals_get&conv_id=${encodeURIComponent(conv_id)}${tokenParam}`, { cache: 'no-store' })
          const apData = await apRes.json()
          const ap = apData?.data?.approval
          if (ap?.quote_number) {
            const html = buildQuotationEmailHtml({
              clientName:      ap.created_by_name ?? '',
              clientEmail:     '',
              quotationNumber: ap.quote_number,
              total:           Number(ap.quote_total_bd ?? 0),
              desde:           ap.desde ?? '',
              hasta:           ap.hasta ?? '',
              fechaSalida:     ap.fecha_salida ?? '',
              cartaUrl,
            })
            // Obtener email del cliente via PHP
            const lRes = await fetch(`${CRM_API}?action=approval_letters_by_quotation&quotation_id=${encodeURIComponent(quotation_id)}${tokenParam}`, { cache: 'no-store' })
            const lData = await lRes.json()
            const clientEmail = lData?.letters?.[0]?.client_email ?? lData?.data?.[0]?.client_email ?? ''
            const clientName  = lData?.letters?.[0]?.client_name  ?? ap.created_by_name ?? ''

            if (clientEmail) {
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: 'TransCCL Ventas <ventas@transccl.cl>',
                  to: [clientEmail],
                  subject: `Tu cotización de TransCCL está lista — ${ap.quote_number}`,
                  html: buildQuotationEmailHtml({ clientName, clientEmail, quotationNumber: ap.quote_number, total: Number(ap.quote_total_bd ?? 0), desde: ap.desde ?? '', hasta: ap.hasta ?? '', fechaSalida: ap.fecha_salida ?? '', cartaUrl }),
                }),
              })
              emailSent = r.ok
            }
          }
        } catch { /* non-fatal */ }
      }
    }

    // Despacho WA
    const waRes = await fetch(`${CRM_API}?action=wa_quote_retry${tokenParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id }),
    })
    const waData = await waRes.json()

    return NextResponse.json({ ...waData, email_sent: emailSent, carta_url: cartaUrl })
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
