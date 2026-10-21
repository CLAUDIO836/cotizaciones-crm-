import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'
import { sendTextMessage, sendMediaMessage, getInstanceStatus } from '@/lib/evolution'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { toPhone, message, prospectId, contactId, mediaBase64, mediaMimetype, mediaFileName } = await req.json()
  if (!toPhone) return NextResponse.json({ error: 'toPhone es requerido' }, { status: 400 })
  if (!message && !mediaBase64) return NextResponse.json({ error: 'message o imagen requerida' }, { status: 400 })

  const state = await getInstanceStatus(user.id)
  if (state !== 'open') {
    return NextResponse.json({ error: 'WhatsApp no conectado. Escanea el QR primero.' }, { status: 409 })
  }

  let result: { key?: { id?: string } }
  if (mediaBase64) {
    result = await sendMediaMessage(user.id, toPhone, mediaBase64, mediaMimetype ?? 'image/jpeg', mediaFileName ?? 'imagen.jpg', message ?? '')
  } else {
    result = await sendTextMessage(user.id, toPhone, message)
  }

  const token = await getToken()
  if (token && prospectId) {
    const loggedMessage = mediaBase64 ? (message ? `[Imagen] ${message}` : '[Imagen]') : message

    // Log in whatsapp_messages
    await fetch(`${CRM_API}?action=log_whatsapp_message&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: prospectId,
        contact_id:  contactId ?? null,
        direction:   'out',
        phone:       toPhone,
        message:     loggedMessage,
        wamid:       result.key?.id ?? null,
        user_id:     user.id,
        sender_name: user.name,
      }),
    }).catch(() => null)

    // Log in historial de gestiones (prospect_activities)
    await fetch(`${CRM_API}?action=activity_create&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: prospectId,
        contact_id:  contactId ?? null,
        type:        'whatsapp',
        result:      'contacted',
        notes:       loggedMessage.length > 120 ? loggedMessage.slice(0, 120) + '…' : loggedMessage,
      }),
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true, messageId: result.key?.id })
}
