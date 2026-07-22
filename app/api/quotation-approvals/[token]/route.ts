import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await crmGet('approvals_get', { token })
  return NextResponse.json(r.data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const authToken = req.cookies.get('crm_token')?.value ?? null
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await crmPost('approvals_delete', { token }, {}, authToken)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
