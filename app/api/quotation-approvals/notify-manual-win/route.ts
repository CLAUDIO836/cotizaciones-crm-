import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quotation_id } = await req.json()
  if (!quotation_id) return NextResponse.json({ error: 'quotation_id required' }, { status: 400 })

  const r = await crmGet('quotations_get', { id: quotation_id }, token)
  const q = r.data as Record<string, unknown>

  if (!q?.pipedrive_deal_id || !PIPEDRIVE_TOKEN) return NextResponse.json({ ok: true })

  const vendedor = (q.profile_name as string) ?? 'Vendedor'
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
