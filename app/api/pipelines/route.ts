import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const all = req.nextUrl.searchParams.get('all')
  const r = await crmGet('pipelines_list', all ? { all: '1' } : {}, token)
  return NextResponse.json(r.data)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const action = body.id ? 'pipelines_update' : 'pipelines_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r.data)
}
