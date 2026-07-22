import { fetchQuotation, crmPost, getToken } from '@/lib/api'
import { htmlToPdf } from '@/lib/pdf/html-to-pdf'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API   = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  if (!PIPEDRIVE_TOKEN) {
    return NextResponse.json({ error: 'PIPEDRIVE_API_TOKEN no configurado' }, { status: 500 })
  }

  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { quotationId, pipelineId, fechaSalida, companyName, desde, hasta, resync } = await req.json()
  if (!quotationId) {
    return NextResponse.json({ error: 'Falta quotationId' }, { status: 400 })
  }

  const q = await fetchQuotation(quotationId)
  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  // Mapeo email CRM → user_id Pipedrive
  const PIPEDRIVE_USERS: Record<string, number> = {
    'claudio@transccl.cl':        563196,
    'ventas@transccl.cl':         2008020,
    'ecomercial1@transccl.cl':    563218,
    'ecomercial2@transccl.cl':    563943,
    'ecomercial3@transccl.cl':    2386983,
    'ecomercial4@transccl.cl':    15372325,
    'ecomercial5@transccl.cl':    15372314,
    'ecomercial6@transccl.cl':    15372336,
    'clsaldivia@transportesklaus.cl': 572704,
  }

  const vendedorEmail = (q.profiles as { email?: string })?.email ?? q.profile_email ?? ''
  const pipedriveUserId = PIPEDRIVE_USERS[vendedorEmail]

  // Prefijo según empresa
  const COMPANY_PREFIX: Record<string, string> = {
    'Transccl': 'CCL',
    'Transportes TKS': 'TKS',
    'TrackingCCL': 'TCCL',
  }
  const effectiveCompanyName = companyName ?? (q.companies as { name?: string })?.name ?? ''
  const prefix = COMPANY_PREFIX[effectiveCompanyName] ?? 'CCL'
  const effectiveDesde = desde ?? (q as { desde?: string }).desde ?? ''
  const effectiveHasta = hasta ?? (q as { hasta?: string }).hasta ?? ''
  const ruta = (effectiveDesde && effectiveHasta) ? ` - ${effectiveDesde.split(',')[0].trim()} / ${effectiveHasta.split(',')[0].trim()}` : ''
  const effectiveFechaSalida = fechaSalida ?? (q as { fecha_salida?: string }).fecha_salida ?? ''

  // Formatear fecha salida para el título: "2026-08-15" → "15/08/2026"
  function formatFecha(f?: string) {
    if (!f) return ''
    const d = f.slice(0, 10).split('-')
    if (d.length !== 3) return ''
    return `${d[2]}/${d[1]}/${d[0]}`
  }
  const fechaLabel = effectiveFechaSalida ? ` - ${formatFecha(effectiveFechaSalida)}` : ''

  // Generar PDF desde el HTML de "Ver / Imprimir"
  const appUrl = process.env.APP_URL ?? 'https://crm.transccl.cl'
  const crmToken = await getToken()
  const htmlUrl = `${appUrl}/api/cotizaciones/${quotationId}/html?token=${crmToken}`
  const pdfBuffer = await htmlToPdf(htmlUrl)

  let dealId: number

  // RE-SYNC: el negocio ya existe en Pipedrive → actualizar título y reemplazar PDF
  if (resync && q.pipedrive_deal_id) {
    dealId = Number(q.pipedrive_deal_id)
    const finalTitle = `${prefix}-${dealId}${fechaLabel} - ${(q.clients as { name?: string })?.name ?? 'Sin cliente'}${ruta}`

    await fetch(`${PIPEDRIVE_API}/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: finalTitle, value: q.total ?? 0 }),
    })
  } else {
    // NUEVO NEGOCIO
    const dealBody: Record<string, unknown> = {
      title: `${prefix}-TEMP${fechaLabel}${ruta}`,
      value: q.total ?? 0,
      currency: 'CLP',
    }
    if (pipedriveUserId) dealBody.user_id = pipedriveUserId
    if (pipelineId) dealBody.pipeline_id = Number(pipelineId)
    if (effectiveFechaSalida) dealBody.expected_close_date = effectiveFechaSalida.slice(0, 10)

    const dealRes = await fetch(`${PIPEDRIVE_API}/deals?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dealBody),
    })
    const dealJson = await dealRes.json()
    dealId = dealJson.data?.id

    if (!dealId) {
      return NextResponse.json({ error: 'Error creando negocio en Pipedrive', detail: dealJson }, { status: 500 })
    }

    const finalTitle = `${prefix}-${dealId}${fechaLabel} - ${(q.clients as { name?: string })?.name ?? 'Sin cliente'}${ruta}`

    await crmPost('quotations_update', { id: quotationId, pipedrive_deal_id: String(dealId), number: String(dealId) }, {}, token)

    await fetch(`${PIPEDRIVE_API}/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: finalTitle }),
    })
  }

  // Subir PDF a Pipedrive
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `${prefix}-${dealId}.pdf`)
  formData.append('deal_id', String(dealId))

  const res = await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    body: formData,
  })

  const result = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: 'Error subiendo a Pipedrive', detail: result }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dealId, fileId: result.data?.id })
}
