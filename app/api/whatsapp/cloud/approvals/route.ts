import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'
import { sendViaGmail } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = await getToken()

  const convId = req.nextUrl.searchParams.get('conv_id')
  if (!convId) return NextResponse.json({ error: 'conv_id requerido' }, { status: 400 })

  try {
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    const res = await fetch(`${CRM_API}?action=wa_approvals_get&conv_id=${encodeURIComponent(convId)}${tokenParam}`, {
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = await getToken()

  try {
    const body = await req.json()

    // 1. Aprobar/rechazar en PHP — skip_dispatch=true para que Next.js controle el despacho WA
    //    después de subir a Pipedrive (así el número PD ya está actualizado en DB)
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    const res = await fetch(`${CRM_API}?action=wa_approvals_decide${tokenParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, _executor_id: session.id, skip_dispatch: true }),
    })
    const data = await res.json()

    // Para rechazos o errores, devolver directamente
    if (!res.ok || !data.aprobado) return NextResponse.json(data, { status: res.status })

    // ── Post-aprobación: mismo flujo que ejecutiva ─────────────────────────────
    const quotationId: string = data.quotation_id ?? ''
    const convId: string      = data.conv_id      ?? ''
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin

    let pdResult: Record<string, unknown>  = {}
    let emailSent    = false
    let waDispatched = false
    let cartaUrl: string | null = null

    // 2. Subir a Pipedrive → asigna número oficial (igual que ejecutiva)
    if (quotationId && token) {
      try {
        const pdRes = await fetch(`${baseUrl}/api/pipedrive/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
          body: JSON.stringify({ quotationId }),
        })
        pdResult = await pdRes.json()
        if (!pdRes.ok) console.error('[approvals] PD upload failed:', pdResult)
      } catch (e) {
        console.error('[approvals] PD upload error:', e)
      }
    }

    // 3. Carta de aprobación (siempre — WA y ejecutivos)
    if (quotationId && token) {
      try {
        const cartaRes = await fetch(`${CRM_API}?action=letters_create&token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quotation_id: quotationId }),
          cache: 'no-store',
        })
        const cartaData = await cartaRes.json()
        const letter = cartaData.data as Record<string, unknown> | undefined
        if (letter?.token) cartaUrl = `${baseUrl}/firmar/${letter.token}`
      } catch { /* non-fatal */ }
    }

    // 4. Email al cliente via Gmail del vendedor asignado (no del aprobador)
    if (quotationId && cartaUrl && token) {
      try {
        // Obtener Gmail token + datos del vendedor asignado a la cotización
        const gtRes = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const gtData = await gtRes.json()
        const vendorRefreshToken: string = gtData?.data?.refresh_token ?? ''
        const vendorEmail: string        = gtData?.data?.email ?? 'ventas@transccl.cl'
        const vendorName:  string        = gtData?.data?.name  ?? 'TransCCL Ventas'

        // Obtener datos del cliente de la cotización
        const qRes = await fetch(`${CRM_API}?action=quotations_get&id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const qData = await qRes.json()
        const q = qData?.data ?? qData?.quotation ?? {}
        const clientEmail: string = q.contact_email ?? ''
        const clientName:  string = q.contact_name  ?? q.client_name ?? ''
        const quoteNumber: string = String(q.number ?? q.pipedrive_deal_id ?? quotationId.slice(0, 8))
        const total:       number = Number(q.total ?? 0)

        if (clientEmail) {
          const html = buildQuotationEmailHtml({
            clientName, clientEmail, quotationNumber: quoteNumber,
            total, desde: q.desde ?? '', hasta: q.hasta ?? '',
            fechaSalida: q.fecha_salida ?? '', cartaUrl,
          })

          if (vendorRefreshToken) {
            // Vendedor tiene Gmail conectado → enviar desde su cuenta
            await sendViaGmail({
              refreshToken: vendorRefreshToken,
              from:    `${vendorName} <${vendorEmail}>`,
              to:      clientEmail,
              subject: `Tu cotización de TransCCL está lista — ${quoteNumber}`,
              html,
            })
          } else {
            // Vendedor sin Gmail conectado → fallback a ventas@transccl.cl via Resend
            const resendKey = process.env.RESEND_API_KEY
            if (resendKey) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from:    'TransCCL Ventas <ventas@transccl.cl>',
                  to:      [clientEmail],
                  subject: `Tu cotización de TransCCL está lista — ${quoteNumber}`,
                  html,
                }),
              })
            }
          }
          emailSent = true
        }
      } catch (e) {
        console.error('[approvals] Gmail send error:', e)
      }
    }

    // 5. Despacho WA (después del PD upload → número ya actualizado en DB)
    if (convId && token) {
      try {
        const waRes = await fetch(`${CRM_API}?action=wa_quote_retry&token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conv_id: convId }),
        })
        const waData = await waRes.json()
        waDispatched = waData.reintentado === true
      } catch { /* non-fatal — WA puede no estar habilitado */ }
    }

    return NextResponse.json({
      ...data,
      pd_upload:    pdResult,
      email_sent:   emailSent,
      carta_url:    cartaUrl,
      wa_dispatched: waDispatched,
    })
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
