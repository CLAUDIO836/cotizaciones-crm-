import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

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
    .select('id, signed_at')
    .eq('token', token)
    .single()

  if (!letter) return NextResponse.json({ error: 'Carta no encontrada' }, { status: 404 })
  if (letter.signed_at) return NextResponse.json({ error: 'Este documento ya fue firmado' }, { status: 409 })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''

  const updateData: Record<string, string | null> = {
    signed_at: new Date().toISOString(),
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

  return NextResponse.json({ ok: true })
}
