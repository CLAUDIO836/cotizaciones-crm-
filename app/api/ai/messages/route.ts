import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.conversation_id || !body.content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  try {
    const r = await crmPost('ai_messages_create', body, {}, token)
    return NextResponse.json(r.data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
