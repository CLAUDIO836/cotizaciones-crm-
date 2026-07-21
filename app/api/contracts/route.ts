import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const action = body.id && body.status ? 'contracts_update_status' : 'contracts_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r)
}
