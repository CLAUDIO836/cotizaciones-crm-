import { NextRequest, NextResponse } from 'next/server'
import { crmGet } from '@/lib/api'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const r = await crmGet('letters_get', { token })
  const letter = r.data as Record<string, unknown>
  if (!letter) return new NextResponse('Not found', { status: 404 })

  const companyName = String(letter.company_name ?? '')
  const PdfComponent = companyName.includes('TKS') ? TKSApprovalLetterPDF : ApprovalLetterPDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfEl = React.createElement(PdfComponent as any, { data: letter })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(pdfEl as any)

  const filename = letter.signed_at
    ? `Carta-FIRMADA-${letter.quotation_id}.pdf`
    : `Carta-Aprobacion-${letter.quotation_id}.pdf`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
