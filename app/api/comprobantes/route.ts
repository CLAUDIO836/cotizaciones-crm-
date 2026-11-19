import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const quotationId = searchParams.get('quotation_id') ?? ''
  const r = await crmGet('quotation_comprobantes_list', { quotation_id: quotationId }, token)
  return NextResponse.json(r)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const action = body._action === 'reject' ? 'comprobante_reject' : 'comprobante_validate'
  try {
    const r = await crmPost(action, body, {}, token)
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
