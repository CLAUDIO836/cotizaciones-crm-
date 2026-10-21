import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const res = await fetch(`${CRM_API}?action=delete_call&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    return NextResponse.json({ error: data.error ?? 'Error' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
