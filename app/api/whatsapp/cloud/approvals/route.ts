import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const convId = req.nextUrl.searchParams.get('conv_id')
  if (!convId) return NextResponse.json({ error: 'conv_id requerido' }, { status: 400 })

  try {
    const res = await fetch(`${CRM_API}?action=wa_approvals_get&conv_id=${encodeURIComponent(convId)}`, {
      headers: { 'x-user-id': session.id, 'x-user-role': session.role ?? '' },
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

  try {
    const body = await req.json()
    const res = await fetch(`${CRM_API}?action=wa_approvals_decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.id,
        'x-user-role': session.role ?? '',
      },
      body: JSON.stringify({ ...body, _executor_id: session.id }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
