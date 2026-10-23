import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { crmGet } from '@/lib/api'
import { getSession } from '@/lib/api'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) return NextResponse.json({ error: 'campaign_id requerido' }, { status: 400 })

  try {
    const data = await crmGet('call_plan_week', { campaign_id: campaignId })
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar el plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
