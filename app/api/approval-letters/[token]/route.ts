import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await crmGet('letters_get', { token })
  return NextResponse.json(r.data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const authToken = await getToken()
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await crmPost('letters_delete', { token }, {}, authToken)
  return NextResponse.json({ ok: true })
}
