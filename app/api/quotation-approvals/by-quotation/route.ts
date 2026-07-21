import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const quotation_id = req.nextUrl.searchParams.get('quotation_id') ?? ''
  if (!quotation_id) return NextResponse.json({ approval: null })
  const r = await crmGet('approvals_by_quotation', { quotation_id }, token)
  return NextResponse.json({ approval: r.data ?? null })
}
