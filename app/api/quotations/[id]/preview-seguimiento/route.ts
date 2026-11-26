import { NextRequest, NextResponse } from 'next/server'
import { getToken, fetchPipelines } from '@/lib/api'
import fs from 'fs'
import path from 'path'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

const LOGO_URL       = 'https://www.transccl.cl/img/logo-email.png'
const BUS_IMG_URL    = 'https://www.transccl.cl/img/bus-email.jpg'

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return raw
  if (digits.startsWith('56')) return '+' + digits
  if (digits.startsWith('9') && digits.length === 9) return '+56' + digits
  return '+56' + digits
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: quotationId } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin

  try {
    // 1. Carta (URL de cotización para el cliente) — misma lógica que preview-email
    const lettersRes = await fetch(
      `${CRM_API}?action=letters_by_quotation&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    )
    const lettersData = await lettersRes.json()
    const letters: Array<{ token: string }> = lettersData?.letters ?? lettersData?.data ?? []

    let cartaUrl: string | null = null
    if (letters.length > 0) {
      cartaUrl = `${baseUrl}/firmar/${(letters[0] as Record<string, string>).token}`
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

    // 2. Datos del vendedor

    const gtRes = await fetch(
      `${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    )
    const gtData = await gtRes.json()
    const vendorEmail: string = gtData?.data?.email   ?? 'ventas@transccl.cl'
    const vendorName:  string = gtData?.data?.name    ?? 'TransCCL Ventas'
    const vendorPhone: string = gtData?.data?.celular ? formatPhone(gtData.data.celular) : '+56 2 2945 5713'

    // 3. Datos de la cotización
    const qRes = await fetch(
      `${CRM_API}?action=quotations_get&id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    )
    const qData = await qRes.json()
    const q = qData?.data ?? qData?.quotation ?? {}
    const quoteNumber: string = String(q.number ?? q.pipedrive_deal_id ?? quotationId.slice(0, 8))

    let clientName: string = q.contact_name ?? q.client_name ?? ''
    let clientEmail: string = q.contact_email ?? q.client_email ?? ''
    if (!clientName && letters.length > 0) {
      clientName = (letters[0] as Record<string, string>).client_name ?? ''
    }
    if (!clientEmail && letters.length > 0) {
      clientEmail = (letters[0] as Record<string, string>).client_email ?? ''
    }

    // 4. Leer la plantilla HTML
    const templatePath = path.join(process.cwd(), 'lib', 'email-templates', 'seguimiento.html')
    let html: string
    if (fs.existsSync(templatePath)) {
      html = fs.readFileSync(templatePath, 'utf-8')
    } else {
      return NextResponse.json({ error: 'Plantilla de seguimiento no encontrada en lib/email-templates/seguimiento.html' }, { status: 500 })
    }

    // 5. Determinar URL del botón (misma lógica que preview-email)
    const cartaToken = letters.length > 0 ? (letters[0] as Record<string, string>).token : (cartaUrl?.split('/firmar/')[1] ?? '')
    const pipelines = await fetchPipelines()
    const pipeline = pipelines.find(p => p.id === String(q.pipeline_id ?? '')) ?? null
    const pipelineName = ((pipeline?.name ?? q.pipeline_name ?? '') as string).toLowerCase()
    const isDiario = pipelineName.includes('diario')

    let cotizacionUrl: string
    if (isDiario) {
      cotizacionUrl = cartaToken
        ? `${baseUrl}/api/cotizaciones/${quotationId}/propuesta?token=${cartaToken}`
        : `${baseUrl}/api/cotizaciones/${quotationId}/propuesta`
    } else {
      // Mismo URL que "Ver / Imprimir": el HTML completo de la cotización
      cotizacionUrl = cartaToken
        ? `${baseUrl}/api/cotizaciones/${quotationId}/html?token=${cartaToken}`
        : `${baseUrl}/api/cotizaciones/${quotationId}/html`
    }

    // 6. Reemplazar placeholders
    const firstName = clientName ? clientName.split(' ')[0] : 'Cliente'

    html = html
      .replace(/\{\{logo_url\}\}/g,            LOGO_URL)
      .replace(/\{\{imagen_bus_url\}\}/g,       BUS_IMG_URL)
      .replace(/\{\{cotizacion_numero\}\}/g,    quoteNumber)
      .replace(/\{\{cliente_nombre\}\}/g,       firstName)
      .replace(/\{\{cotizacion_url\}\}/g,       cotizacionUrl)
      .replace(/\{\{ejecutivo_nombre\}\}/g,     vendorName)
      .replace(/\{\{ejecutivo_cargo\}\}/g,      'Ejecutiva Comercial')
      .replace(/\{\{ejecutivo_telefono\}\}/g,   vendorPhone)
      .replace(/\{\{ejecutivo_email\}\}/g,      vendorEmail)

    return NextResponse.json({
      html,
      to:      clientEmail,
      subject: `Seguimiento cotización TransCCL — ${quoteNumber}`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
