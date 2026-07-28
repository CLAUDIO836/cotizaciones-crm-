import { NextRequest, NextResponse } from 'next/server'
import { getToken, fetchQuotation } from '@/lib/api'
import { htmlToPdf } from '@/lib/pdf/html-to-pdf'

export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = await fetchQuotation(id)
  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const appUrl = process.env.APP_URL ?? 'https://crm.transccl.cl'
  const htmlUrl = `${appUrl}/api/cotizaciones/${id}/propuesta?token=${encodeURIComponent(token)}`

  const pdfBuffer = await htmlToPdf(htmlUrl)

  const number = (q as { number?: string }).number ?? id
  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="propuesta-${number}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
