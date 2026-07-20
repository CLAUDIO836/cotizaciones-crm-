import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: letter } = await supabase
    .from('approval_letters')
    .select('*')
    .eq('token', token)
    .single()

  if (!letter) return new NextResponse('Not found', { status: 404 })

  const PdfComponent = letter.company_name?.includes('TKS') ? TKSApprovalLetterPDF : ApprovalLetterPDF
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
