import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  try {
    const r = await crmPost('wa_bot_reactivate', body, {}, token)
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
