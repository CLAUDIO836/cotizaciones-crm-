import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const params: Record<string, string> = {}
  for (const [k, v] of searchParams.entries()) params[k] = v
  try {
    const r = await crmGet('ai_conversations_list', params, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  try {
    const r = await crmPost('ai_conversations_create', body, {}, token)
    return NextResponse.json(r.data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
