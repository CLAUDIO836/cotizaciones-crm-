import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { ApprovalLetterPDF } from '@/lib/pdf/approval-letter'
import { TKSApprovalLetterPDF } from '@/lib/pdf/tks-approval-letter'
import React from 'react'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

const COMPANY_NAME_MAP: Record<string, string> = {
  'Transccl': 'Transccl SpA',
  'Transportes TKS': 'Transportes TKS SpA',
  'TrackingCCL': 'TrackingCCL SpA',
}

async function uploadPipedrivePDF(dealId: string, pdfBuffer: Buffer, filename: string) {
  if (!PIPEDRIVE_TOKEN || !dealId) return null
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), filename)
  formData.append('deal_id', dealId)
  const res = await fetch(`${PIPEDRIVE_API}/files?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    body: formData,
  })
  const json = await res.json()
  return json.data?.id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id required' }, { status: 400 })

  const admin = getAdminClient()

  const { data: q } = await admin
    .from('quotations')
    .select(`*, clients(name, rut, email, phone), profiles(name)`)
    .eq('id', quotation_id)
    .single()

  if (!q) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const companyName = COMPANY_NAME_MAP[q.company ?? ''] ?? q.company ?? 'Transccl SpA'

  const letterData = {
    quotation_id,
    client_name: q.clients?.name ?? '',
    client_rut: q.clients?.rut ?? null,
    client_email: q.clients?.email ?? null,
    client_phone: q.clients?.phone ?? null,
    seller_name: q.profiles?.name ?? null,
    desde: q.desde ?? null,
    hasta: q.hasta ?? null,
    fecha_salida: q.fecha_salida ?? null,
    hora_salida: q.hora_salida ?? null,
    fecha_retorno: q.fecha_retorno ?? null,
    hora_retorno: q.hora_retorno ?? null,
    total: q.total ?? null,
    company_name: companyName,
    sent_at: new Date().toISOString(),
  }

  const { data: letter, error } = await admin
    .from('approval_letters')
    .insert(letterData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
  const url = `${baseUrl}/firmar/${letter.token}`

  // Generar PDF y subir a Pipedrive en background
  if (q.pipedrive_deal_id) {
    try {
      const PdfComponent = q.company === 'Transportes TKS' ? TKSApprovalLetterPDF : ApprovalLetterPDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfEl = React.createElement(PdfComponent as any, { data: { ...letterData, token: letter.token } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = await renderToBuffer(pdfEl as any)
      await uploadPipedrivePDF(q.pipedrive_deal_id, buf, `Carta-Aprobacion-${q.number ?? quotation_id}.pdf`)
    } catch (e) {
      console.error('Error subiendo carta a Pipedrive:', e)
    }
  }

  return NextResponse.json({ ok: true, token: letter.token, url })
}
