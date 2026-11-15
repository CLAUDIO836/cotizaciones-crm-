import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { generateQuotationHtml } from '@/lib/quotation-html'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

async function fetchStgQuotation(id: string, userToken: string) {
  const res = await fetch(
    `${CRM_API_STG}?action=quotations_get&id=${encodeURIComponent(id)}&token=${encodeURIComponent(userToken)}`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${userToken}` } },
  )
  const data = await res.json()
  return data.data ?? null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userToken = await getToken()
  if (!userToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const baseUrl = req.nextUrl.origin

  const q = await fetchStgQuotation(id, userToken)
  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return new NextResponse(generateQuotationHtml(q, baseUrl, true), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
