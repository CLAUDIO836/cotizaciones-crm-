import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''

  try {
    const qs = new URLSearchParams({ action: 'wa_sofia_metrics' })
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    const res = await fetch(`${CRM_API}?${qs}`, {
      headers: { 'x-user-id': session.id, 'x-user-role': session.role ?? '' },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
