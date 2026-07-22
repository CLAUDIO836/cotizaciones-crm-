import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function POST() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await crmPost('contacts_import_from_quotations', {}, {}, token)
  return NextResponse.json(r)
}

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const action = req.nextUrl.searchParams.get('action') ?? 'diagnostico_clientes'
  const r = await crmGet(action, {}, token)
  return NextResponse.json(r)
}
