import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { signed_name, signed_rut, billing_name, billing_rut, billing_address, billing_company, billing_glosa } = body

  if (!signed_name || !signed_rut) {
    return NextResponse.json({ error: 'Nombre y RUT requeridos' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: letter } = await admin
    .from('approval_letters')
    .select('*, quotations(pipedrive_deal_id, number)')
    .eq('token', token)
    .single()

  if (!letter) return NextResponse.json({ error: 'Carta no encontrada' }, { status: 404 })
  if (letter.signed_at) return NextResponse.json({ error: 'Este documento ya fue firmado' }, { status: 409 })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''
  const signedAt = new Date().toISOString()

  const updateData: Record<string, string | null> = {
    signed_at: signedAt,
    signed_name,
    signed_rut,
    signed_ip: ip,
    signed_user_agent: userAgent,
  }

  if (billing_name) {
    updateData.billing_name = billing_name
    updateData.billing_rut = billing_rut ?? null
    updateData.billing_address = billing_address ?? null
    updateData.billing_company = billing_company ?? null
    updateData.billing_glosa = billing_glosa ?? null
  }

  const { error } = await admin
    .from('approval_letters')
    .update(updateData)
    .eq('token', token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Subir PDF firmado a Pipedrive
  const dealId = letter.quotations?.pipedrive_deal_id
  if (dealId && PIPEDRIVE_TOKEN) {
    try {
      const letterData = {
        ...letter,
        signed_at: signedAt,
        signed_name,
        signed_rut,
        signed_ip: ip,
        ...(billing_name ? { billing_name, billing_rut, billing_address, billing_company, billing_glosa } : {}),
      }
      const PdfComponent = letter.company_name?.includes('TKS') ? TKSApprovalLetterPDF : ApprovalLetterPDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfEl = React.createElement(PdfComponent as any, { data: letterData })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = await renderToBuffer(pdfEl as any)

      const formData = new FormData()
      const filename = `Carta-FIRMADA-${letter.quotations?.number ?? dealId}.pdf`
      formData.append('file', new Blob([new Uint8Array(buf)], { type: 'application/pdf' }), filename)
      formData.append('deal_id', dealId)

      await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, {
        method: 'POST',
        body: formData,
      })
    } catch (e) {
      console.error('Error subiendo carta firmada a Pipedrive:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
