import { getToken, crmGet } from '@/lib/api'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const r = await crmGet('quotation_pdfs_list', { quotation_id: id }, token)
  return NextResponse.json({ ok: true, data: r.data ?? [] })
}
