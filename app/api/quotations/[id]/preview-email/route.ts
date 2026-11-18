import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // 2. Datos del vendedor
    const gtRes = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const gtData = await gtRes.json()
    const vendorEmail: string = gtData?.data?.email   ?? 'ventas@transccl.cl'
    const vendorName:  string = gtData?.data?.name    ?? 'TransCCL Ventas'
    const vendorPhone: string = gtData?.data?.celular ?? '+56 2 2945 5713'

    // 3. Datos de la cotización
    const qRes = await fetch(`${CRM_API}?action=quotations_get&id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const qData = await qRes.json()
    const q = qData?.data ?? qData?.quotation ?? {}
    const quoteNumber: string = String(q.number ?? q.pipedrive_deal_id ?? quotationId.slice(0, 8))
    const total:       number = Number(q.total ?? 0)

    let clientEmail: string = q.contact_email ?? q.client_email ?? ''
    let clientName:  string = q.contact_name  ?? q.client_name  ?? ''
    if (!clientEmail && letters.length > 0) {
      const l = letters[0] as Record<string, string>
      clientEmail = l.client_email ?? ''
      clientName  = clientName || l.client_name || ''
    }

    // 4. Construir HTML (sin enviar)
    const cartaToken = letters.length > 0 ? (letters[0] as Record<string, string>).token : cartaUrl.split('/firmar/')[1] ?? ''
    const propuestaUrl = cartaToken ? `${baseUrl}/api/cotizaciones/${quotationId}/html?token=${cartaToken}` : undefined

    const html = buildQuotationEmailHtml({
      clientName, clientEmail, quotationNumber: quoteNumber,
      total, desde: q.desde ?? '', hasta: q.hasta ?? '',
      fechaSalida: q.fecha_salida ?? '', cartaUrl, propuestaUrl,
      vendorName, vendorEmail, vendorPhone,
    })

    return NextResponse.json({
      html,
      to:      clientEmail,
      subject: `Tu cotización de TransCCL está lista — ${quoteNumber}`,
      carta_url: cartaUrl,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
