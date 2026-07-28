import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const r = await crmGet('ai_conversations_get', { id }, token)
    if (!r.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
