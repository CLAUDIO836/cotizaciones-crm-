import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id required' }, { status: 400 })

  try {
    const r = await crmPost('letters_create', { quotation_id }, {}, token)
    const letter = r.data as Record<string, unknown>

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
    const url = `${baseUrl}/firmar/${letter.token}`

    // Upload PDF to Pipedrive in background
    if (letter.pipedrive_deal_id && PIPEDRIVE_TOKEN) {
      try {
        const PdfComponent = (letter.company_name as string)?.includes('TKS') ? TKSApprovalLetterPDF : ApprovalLetterPDF
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfEl = React.createElement(PdfComponent as any, { data: { ...letter, token: letter.token } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buf = await renderToBuffer(pdfEl as any)
        const formData = new FormData()
        formData.append('file', new Blob([new Uint8Array(buf)], { type: 'application/pdf' }), `Carta-Aprobacion.pdf`)
        formData.append('deal_id', letter.pipedrive_deal_id as string)
        await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, { method: 'POST', body: formData })
      } catch (e) { console.error('Pipedrive upload error:', e) }
    }

    return NextResponse.json({ ok: true, token: letter.token, url })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
