export const maxDuration = 60

import { fetchQuotation, crmPost, getToken } from '@/lib/api'
import { htmlToPdf } from '@/lib/pdf/html-to-pdf'
import { NextRequest, NextResponse } from 'next/server'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API   = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  if (!PIPEDRIVE_TOKEN) {
    return NextResponse.json({ error: 'PIPEDRIVE_API_TOKEN no configurado' }, { status: 500 })
  }

  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { quotationId, pipelineId, fechaSalida, companyName, desde, hasta } = await req.json()
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
  const prefix = COMPANY_PREFIX[companyName ?? ''] ?? 'CCL'
  const ruta = (desde && hasta) ? ` - ${desde.split(',')[0].trim()} / ${hasta.split(',')[0].trim()}` : ''

  // Formatear fecha salida para el título: "2026-08-15" → "15/08/2026"
  function formatFecha(f?: string) {
    if (!f) return ''
    const d = f.slice(0, 10).split('-')
    if (d.length !== 3) return ''
    return `${d[2]}/${d[1]}/${d[0]}`
  }
  const fechaLabel = fechaSalida ? ` - ${formatFecha(fechaSalida)}` : ''

  // Crear negocio en Pipedrive (título provisional, se actualiza con dealId después)
  const dealBody: Record<string, unknown> = {
    title: `${prefix}-TEMP${fechaLabel}${ruta}`,
    value: q.total ?? 0,
    currency: 'CLP',
  }
  if (pipedriveUserId) dealBody.user_id = pipedriveUserId
  if (pipelineId) dealBody.pipeline_id = Number(pipelineId)
  if (fechaSalida) dealBody.expected_close_date = fechaSalida.slice(0, 10)

  const dealRes = await fetch(`${PIPEDRIVE_API}/deals?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dealBody),
  })
  const dealJson = await dealRes.json()
  const dealId = dealJson.data?.id

  if (!dealId) {
    return NextResponse.json({ error: 'Error creando negocio en Pipedrive', detail: dealJson }, { status: 500 })
  }

  // Título final con número real de Pipedrive
  const finalTitle = `${prefix}-${dealId}${fechaLabel} - ${(q.clients as { name?: string })?.name ?? q.client_name ?? 'Sin cliente'}${ruta}`

  // Guardar deal ID y actualizar número de cotización con el ID del negocio
  await crmPost('quotations_update', { id: quotationId, pipedrive_deal_id: String(dealId), number: String(dealId) }, {}, token)

  // Actualizar título del negocio en Pipedrive con número real
  await fetch(`${PIPEDRIVE_API}/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: finalTitle }),
  })

  // Generar PDF desde el HTML de "Ver / Imprimir" (idéntico al que ve el usuario)
  const appUrl = process.env.APP_URL ?? 'https://crm.transccl.cl'
  const crmToken = await getToken()
  const htmlUrl = `${appUrl}/api/cotizaciones/${quotationId}/html?token=${crmToken}`
  const pdfBuffer = await htmlToPdf(htmlUrl)

  // Subir archivo a Pipedrive
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
