import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const r = await fetch(`${CRM_API}?action=send_no_gestion_reminders&secret=transccl-cron-2024&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const d = await r.json()
  return NextResponse.json(d)
}
