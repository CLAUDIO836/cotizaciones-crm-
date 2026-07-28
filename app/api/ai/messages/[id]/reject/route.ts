import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { note } = await req.json().catch(() => ({ note: null }))
  try {
    const r = await crmPost('ai_messages_reject', { id, note: note ?? null }, {}, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
