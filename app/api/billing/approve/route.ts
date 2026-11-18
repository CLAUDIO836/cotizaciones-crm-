import { NextRequest, NextResponse } from 'next/server'
import { getToken, crmPost } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  await crmPost('billing_approve', body, {}, token)
  return NextResponse.json({ ok: true })
}
