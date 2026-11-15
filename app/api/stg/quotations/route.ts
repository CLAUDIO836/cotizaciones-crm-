import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

// GET /api/stg/quotations?id=xxx — carga una cotización desde staging DB
export async function GET(req: NextRequest) {
  const userToken = await getToken()
  if (!userToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  try {
    const res = await fetch(
      `${CRM_API_STG}?action=quotations_get&id=${encodeURIComponent(id)}`,
      { cache: 'no-store', headers: { 'X-CRM-Token': userToken } },
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}

// POST /api/stg/quotations — guarda/actualiza una cotización en staging DB
export async function POST(req: NextRequest) {
  const userToken = await getToken()
  if (!userToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const action = body.id ? 'quotations_update' : 'quotations_create'
    const res = await fetch(
      `${CRM_API_STG}?action=${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Token': userToken },
        body: JSON.stringify(body),
      },
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
