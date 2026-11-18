import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const quotation_id = req.nextUrl.searchParams.get('quotation_id') ?? ''
  const r = await crmGet('emails_list', { quotation_id }, token)
  return NextResponse.json(r.data)
}
