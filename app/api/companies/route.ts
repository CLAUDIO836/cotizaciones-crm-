import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await crmGet('companies_list', {}, token)
  return NextResponse.json(r.data)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const action = body._action === 'delete' ? 'companies_delete' : 'companies_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r)
}
