import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const params: Record<string, string> = {}
    if (searchParams.get('assigned_to')) params.assigned_to = searchParams.get('assigned_to')!
    if (searchParams.get('stage')) params.stage = searchParams.get('stage')!
    const r = await crmGet('wa_cloud_list', params, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
