import { NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { crmGet } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId } = await params
  const url = new URL(req.url)

  const q: Record<string, string> = { campaign_id: campaignId }
  const date_from = url.searchParams.get('date_from')
  const date_to   = url.searchParams.get('date_to')
  const user_id   = url.searchParams.get('user_id')
  const commune   = url.searchParams.get('commune')

  if (date_from) q.date_from = date_from
  if (date_to)   q.date_to   = date_to
  if (user_id)   q.user_id   = user_id
  if (commune)   q.commune   = commune

  const data = await crmGet('call_dashboard', q)
  return NextResponse.json(data)
}
