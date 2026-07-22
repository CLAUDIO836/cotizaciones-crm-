import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

export const dynamic = 'force-dynamic'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

export async function GET() {
  const token = await getToken()
  const url = `${CRM_API}?action=quotations_summary&token=${encodeURIComponent(token ?? '')}`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  const rows = (data.data ?? []) as Record<string, unknown>[]
  const target = rows.find(r => r.number === '46664' || r.pipedrive_deal_id === '46664')
  return NextResponse.json({ target, total_rows: rows.length })
}
