import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'

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

    // 3. Carta de aprobación (solo para WA — ejecutivos envían email desde su cuenta)
    if (quotationId && convId && token) {
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

    // 4. Despacho WA (después del PD upload → número ya actualizado en DB)
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
