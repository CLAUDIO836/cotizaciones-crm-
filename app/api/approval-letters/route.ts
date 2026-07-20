import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
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

  const companyMap: Record<string, string> = {
    'Transccl': 'Transccl SpA',
    'Transportes TKS': 'Transportes TKS SpA',
    'TrackingCCL': 'TrackingCCL SpA',
  }
  const companyName = companyMap[q.company ?? ''] ?? q.company ?? 'Transccl SpA'

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
  }

  const { data: letter, error } = await admin
    .from('approval_letters')
    .insert(letterData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
  const url = `${baseUrl}/firmar/${letter.token}`

  return NextResponse.json({ ok: true, token: letter.token, url })
}
