import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id required' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: q } = await admin
    .from('quotations')
    .select('number, pipedrive_deal_id, profiles(name, email)')
    .eq('id', quotation_id)
    .single()

  if (!q?.pipedrive_deal_id || !PIPEDRIVE_TOKEN) return NextResponse.json({ ok: true })

  const vendedor = (q.profiles as { name?: string })?.name ?? 'Vendedor'
  const fecha = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })

  const content =
    `⚠️ <b>COTIZACIÓN GANADA MANUALMENTE SIN APROBACIÓN DIGITAL DEL CLIENTE</b><br><br>` +
    `El vendedor <b>${vendedor}</b> marcó esta cotización como <b>Ganada</b> el ${fecha} ` +
    `sin que el cliente haya enviado su aprobación digital.<br><br>` +
    `👉 Se recomienda solicitar al cliente que firme la aprobación de cotización o al menos la carta de aprobación de servicio.`

  await fetch(`${PIPEDRIVE_API}/notes?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, deal_id: Number(q.pipedrive_deal_id) }),
  })

  return NextResponse.json({ ok: true })
}
