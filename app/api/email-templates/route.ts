import { NextRequest, NextResponse } from 'next/server'
import { getToken, crmGet, crmPost } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const data = await crmGet('email_templates_list', {})
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  await crmPost('email_templates_save', body, {}, token)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  await crmPost('email_templates_delete', body, {}, token)
  return NextResponse.json({ ok: true })
}
