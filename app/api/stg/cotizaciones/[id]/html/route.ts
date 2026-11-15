import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { generateQuotationHtml } from '@/lib/quotation-html'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''

async function fetchStgQuotation(id: string, session: { id: string; role?: string | null }) {
  const res = await fetch(`${CRM_API_STG}?action=quotations_get&id=${encodeURIComponent(id)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-token': E2E_TOKEN,
      'x-user-id': session.id,
      'x-user-role': session.role ?? '',
    },
    cache: 'no-store',
  })
  const data = await res.json()
  return data.data ?? null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const baseUrl = req.nextUrl.origin

  const q = await fetchStgQuotation(id, session)
  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return new NextResponse(generateQuotationHtml(q, baseUrl, true), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
