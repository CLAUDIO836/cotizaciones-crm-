import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const quotation_id = req.nextUrl.searchParams.get('quotation_id') ?? ''
  const r = await crmGet('notes_list', { quotation_id }, token)
  return NextResponse.json(r.data)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const action = body._action === 'delete' ? 'notes_delete' : 'notes_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r.data)
}
