import { NextRequest, NextResponse } from 'next/server'
import { getToken, getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crm.transccl.cl'

// GET — lista cotizaciones ganadas desde una fecha
export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const session = await getSession()
  if (!session || !['admin', 'superadmin'].includes(session.role ?? ''))
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const from = req.nextUrl.searchParams.get('from') ?? '2026-01-01'
  try {
    const r = await fetch(`${CRM_API}?action=won_from_date&from=${encodeURIComponent(from)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const text = await r.text()
    const d = JSON.parse(text)
    return NextResponse.json({ quotations: d.data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: `Error al consultar PHP: ${String(e)}` }, { status: 500 })
  }
}

// POST — envía correo + carta a todas las cotizaciones del listado
export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const session = await getSession()
  if (!session || !['admin', 'superadmin'].includes(session.role ?? ''))
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const body = await req.json()
  const ids: string[] = body.ids ?? []
  if (!ids.length) return NextResponse.json({ error: 'Sin IDs' }, { status: 400 })

  const results: { id: string; ok: boolean; sent_to?: string; error?: string }[] = []

  for (const id of ids) {
    try {
      const r = await fetch(`${BASE_URL}/api/quotations/${id}/send-email`, {
        method: 'POST',
        headers: { Cookie: req.headers.get('cookie') ?? '' },
      })
      const d = await r.json()
      if (r.ok) results.push({ id, ok: true, sent_to: d.sent_to })
      else results.push({ id, ok: false, error: d.error ?? `HTTP ${r.status}` })
    } catch (e) {
      results.push({ id, ok: false, error: String(e) })
    }
  }

  return NextResponse.json({ results })
}
