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

const COMPANY_NAME_MAP: Record<string, string> = {
  'Transccl': 'Transccl SpA',
  'Transportes TKS': 'Transportes TKS SpA',
  'TrackingCCL': 'TrackingCCL SpA',
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
    .select(`*, clients(name, rut, email, phone), profiles(name), quotation_items(description, quantity, unit_price, subtotal, sort_order)`)
    .eq('id', quotation_id)
    .single()

  if (!q) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  // Check if approval already exists
  const { data: existing } = await admin
    .from('quotation_approvals')
    .select('id, token, response')
    .eq('quotation_id', quotation_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'already_exists', token: existing.token }, { status: 409 })
  }

  const items = (q.quotation_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((i: { description: string; quantity: number; unit_price: number; subtotal: number }) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
    }))

  const approvalData = {
    quotation_id,
    client_name: q.clients?.name ?? '',
    client_rut: q.clients?.rut ?? null,
    seller_name: q.profiles?.name ?? null,
    desde: q.desde ?? null,
    hasta: q.hasta ?? null,
    fecha_salida: q.fecha_salida ?? null,
    hora_salida: q.hora_salida ?? null,
    fecha_retorno: q.fecha_retorno ?? null,
    hora_retorno: q.hora_retorno ?? null,
    total: q.total ?? null,
    company_name: COMPANY_NAME_MAP[q.company ?? ''] ?? q.company ?? 'Transccl SpA',
    items,
    sent_at: new Date().toISOString(),
  }

  const { data: approval, error } = await admin
    .from('quotation_approvals')
    .insert(approvalData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin
  const url = `${baseUrl}/aprobar/${approval.token}`

  return NextResponse.json({ ok: true, token: approval.token, url })
}
