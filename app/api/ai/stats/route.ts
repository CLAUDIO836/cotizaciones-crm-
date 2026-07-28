import { NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await crmGet('ai_landing_stats', {}, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
