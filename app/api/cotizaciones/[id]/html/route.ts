import { fetchQuotation } from '@/lib/api'
import { generateQuotationHtml } from '@/lib/quotation-html'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const baseUrl = new URL(req.url).origin
  const { id } = await params
  const urlToken = new URL(req.url).searchParams.get('token') ?? undefined

  const q = await fetchQuotation(id, urlToken)
  if (!q) return new Response('Not found', { status: 404 })

  return new Response(generateQuotationHtml(q, baseUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
