import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
  try {
    const r = await crmGet('quotations_summary', { client_id: clientId }, token)
    return NextResponse.json({ data: r.data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
