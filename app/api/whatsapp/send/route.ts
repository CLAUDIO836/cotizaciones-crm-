import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'
import { sendTextMessage, getInstanceStatus } from '@/lib/evolution'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { toPhone, message, prospectId, contactId } = await req.json()
  if (!toPhone || !message) {
    return NextResponse.json({ error: 'toPhone y message son requeridos' }, { status: 400 })
  }

  const state = await getInstanceStatus(user.id)
  if (state !== 'open') {
    return NextResponse.json({ error: 'WhatsApp no conectado. Escanea el QR primero.' }, { status: 409 })
  }

  const result = await sendTextMessage(user.id, toPhone, message)

  // Log activity in CRM
  const token = await getToken()
  if (token && prospectId) {
    await fetch(`${CRM_API}?action=log_whatsapp_message&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: prospectId,
        contact_id:  contactId ?? null,
        direction:   'out',
        phone:       toPhone,
        message,
        wamid:       result.key?.id ?? null,
      }),
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true, messageId: result.key?.id })
}
