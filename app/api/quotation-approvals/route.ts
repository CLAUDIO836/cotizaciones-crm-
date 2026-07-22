import { NextRequest, NextResponse } from 'next/server'
import { crmPost, fetchQuotation, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id required' }, { status: 400 })

  try {
    const q = await fetchQuotation(quotation_id, undefined)
    const qAny = (q ?? {}) as Record<string, unknown>
    const isTKS = ((qAny.company ?? qAny.company_real_name ?? qAny.pipeline_name ?? '') as string).toUpperCase().includes('TKS')

    const r = await crmPost('approvals_create', { quotation_id }, {}, token)
    const d = r.data as Record<string, unknown>
    if (d?.already_exists) {
      return NextResponse.json({ error: 'already_exists', token: d.token }, { status: 409 })
    }
    const baseUrl = isTKS
      ? 'https://aprobaciones.transportestks.com'
      : (process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin)
    return NextResponse.json({ ok: true, token: d.token, url: `${baseUrl}/aprobar/${d.token}` })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
