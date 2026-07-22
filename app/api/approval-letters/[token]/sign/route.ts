import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { signed_name, signed_rut, billing_name, billing_rut, billing_address, billing_company, billing_glosa } = body

  if (!signed_name || !signed_rut) {
    return NextResponse.json({ error: 'Nombre y RUT requeridos' }, { status: 400 })
  }

  try {
    // Call PHP directly with proper JSON body so all fields arrive in body()
    const phpRes = await fetch(`${CRM_API}?action=letters_sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, signed_name, signed_rut, billing_name, billing_rut, billing_address, billing_company, billing_glosa }),
      cache: 'no-store',
    })
    const phpJson = await phpRes.json().catch(() => ({}))
    if (!phpRes.ok) {
      const msg = phpJson.error ?? `HTTP ${phpRes.status}`
      if (msg.includes('Ya fue firmada')) return NextResponse.json({ error: 'Este documento ya fue firmado' }, { status: 409 })
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const letter = phpJson.data as Record<string, unknown>

    // Upload signed PDF to Pipedrive
    const dealId = letter?.pipedrive_deal_id as string | undefined
    if (dealId && PIPEDRIVE_TOKEN) {
      try {
        const PdfComponent = (letter.company_name as string)?.includes('TKS') ? TKSApprovalLetterPDF : ApprovalLetterPDF
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfEl = React.createElement(PdfComponent as any, { data: letter })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buf = await renderToBuffer(pdfEl as any)
        const filename = `Carta-FIRMADA-${letter.quotation_number ?? dealId}.pdf`
        const formData = new FormData()
        formData.append('file', new Blob([new Uint8Array(buf)], { type: 'application/pdf' }), filename)
        formData.append('deal_id', dealId)
        await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, { method: 'POST', body: formData })
      } catch (e) { console.error('Pipedrive upload error:', e) }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = String(e)
    if (msg.includes('Ya fue firmada')) return NextResponse.json({ error: 'Este documento ya fue firmado' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
