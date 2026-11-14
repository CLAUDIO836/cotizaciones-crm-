import { NextRequest, NextResponse } from 'next/server'
import { getToken, getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = await getToken()
  try {
    const res = await fetch(`${CRM_API}?action=stg_conv_list&token=${token}`, {
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json(data, { status: res.status })
    const convs = (data as { data?: { conversations?: unknown[] } }).data?.conversations
    return NextResponse.json(Array.isArray(convs) ? convs : [])
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
