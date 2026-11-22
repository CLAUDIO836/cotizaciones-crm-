import { NextRequest, NextResponse } from 'next/server'
import { getSession, crmGet } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['admin', 'superadmin'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const horas = req.nextUrl.searchParams.get('horas') ?? '24'
  const r = await crmGet('wa_forms_audit', { horas })
  return NextResponse.json(r.data)
}
