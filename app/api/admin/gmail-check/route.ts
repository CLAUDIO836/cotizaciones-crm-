import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const r = await fetch(`${CRM_API}?action=profile_gmail_token&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const d = await r.json()
  const hasToken = !!(d?.data?.refresh_token)
  return NextResponse.json({ has_gmail_token: hasToken, raw: d })
}
