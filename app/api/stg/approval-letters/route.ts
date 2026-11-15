import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id requerido' }, { status: 400 })

  try {
    const res = await fetch(`${CRM_API_STG}?action=letters_create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token },
      body: JSON.stringify({ quotation_id }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json(data, { status: res.status })

    const letter = data.data as Record<string, unknown>
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
    const url = `${baseUrl}/firmar-stg/${letter.token}`

    return NextResponse.json({ ok: true, token: letter.token, url })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
