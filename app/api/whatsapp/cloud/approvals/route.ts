import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = await getToken()

  const convId = req.nextUrl.searchParams.get('conv_id')
  if (!convId) return NextResponse.json({ error: 'conv_id requerido' }, { status: 400 })

  try {
    const res = await fetch(`${CRM_API}?action=wa_approvals_get&conv_id=${encodeURIComponent(convId)}`, {
      headers: {
        'x-user-id': session.id,
        'x-user-role': session.role ?? '',
        ...(token ? { 'X-CRM-Token': token } : {}),
      },
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
    const res = await fetch(`${CRM_API}?action=wa_approvals_decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.id,
        'x-user-role': session.role ?? '',
        ...(token ? { 'X-CRM-Token': token } : {}),
      },
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

    // 3. Carta de aprobación + email al cliente (si tiene email)
    const clientEmail = (data.client_email as string | null)?.trim() ?? null
    const clientName  = (data.client_name  as string | null) ?? ''

    if (quotationId && clientEmail && token) {
      // Crear carta de aprobación
      try {
        const cartaRes = await fetch(`${CRM_API}?action=letters_create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
          body: JSON.stringify({ quotation_id: quotationId }),
          cache: 'no-store',
        })
        const cartaData = await cartaRes.json()
        const letter = cartaData.data as Record<string, unknown> | undefined
        if (letter?.token) cartaUrl = `${baseUrl}/firmar/${letter.token}`
      } catch { /* non-fatal */ }

      // Enviar email vía Resend
      if (cartaUrl) {
        const resendKey = process.env.RESEND_API_KEY
        // Usar el número PD si está disponible, si no el número BWA
        const quoteNumber = typeof pdResult.dealId === 'number'
          ? String(pdResult.dealId)
          : (data.quote_number as string | null) ?? 'Cotización'

        if (resendKey) {
          try {
            const html = buildQuotationEmailHtml({
              clientName,
              clientEmail,
              quotationNumber: quoteNumber,
              total:        Number(data.total       ?? 0),
              desde:        (data.desde             as string | undefined) ?? '',
              hasta:        (data.hasta             as string | undefined) ?? '',
              fechaSalida:  (data.fecha_salida       as string | undefined) ?? '',
              cartaUrl,
            })
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'CRM Transccl <noreply@transccl.cl>',
                to: [clientEmail],
                subject: `Tu cotización de TransCCL está lista — ${quoteNumber}`,
                html,
              }),
            })
            emailSent = r.ok
            if (!r.ok) console.error('[approvals] Resend error:', await r.text())
          } catch (e) {
            console.error('[approvals] email error:', e)
          }
        }
      }
    }

    // 4. Despacho WA (después del PD upload → número ya actualizado en DB)
    if (convId && token) {
      try {
        const waRes = await fetch(`${CRM_API}?action=wa_quote_retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
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
