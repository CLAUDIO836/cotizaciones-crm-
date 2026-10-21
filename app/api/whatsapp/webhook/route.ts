import { NextRequest, NextResponse } from 'next/server'

const CRM_API = 'https://www.transccl.cl/crm-api.php'
const WEBHOOK_SECRET = process.env.EVOLUTION_API_KEY!

export async function POST(req: NextRequest) {
  // Validate API key
  const apiKey = req.headers.get('apikey') ?? req.headers.get('x-api-key')
  if (apiKey !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const event = body.event as string
  if (event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const messages = Array.isArray(body.data) ? body.data : [body.data]
  const instance = body.instance as string

  // Extract user_id from instance name (transccl_<userId>)
  const userId = instance?.replace('transccl_', '') ?? ''

  for (const msg of messages) {
    if (!msg?.key || msg.key.fromMe) continue

    const phone   = (msg.key.remoteJid as string)?.replace('@s.whatsapp.net', '') ?? ''
    const text    = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? ''
    const wamid   = msg.key.id as string
    const pushName = msg.pushName as string ?? ''

    if (!phone || !text) continue

    // Log incoming message in CRM
    await fetch(`${CRM_API}?action=log_whatsapp_message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.INTERNAL_PDF_SECRET ?? '' },
      body: JSON.stringify({
        user_id:   userId,
        direction: 'in',
        phone,
        message:   text,
        wamid,
        sender_name: pushName,
      }),
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
