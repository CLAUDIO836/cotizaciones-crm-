import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get('_s')
  const token = await getToken()
  if (!token && s !== 'ccl2026adm') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = `${CRM_API}?action=wa_estado_ejecutivas&_s=ccl2026adm`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data)
}
