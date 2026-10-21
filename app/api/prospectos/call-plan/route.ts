import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) return NextResponse.json({ error: 'campaign_id requerido' }, { status: 400 })

  const res = await fetch(
    `${CRM_API}?action=call_plan_week&campaign_id=${encodeURIComponent(campaignId)}&token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  )
  const text = await res.text()
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status })
  } catch {
    return NextResponse.json({ error: text.slice(0, 200) }, { status: 502 })
  }
}
