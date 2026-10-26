import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import crypto from 'crypto'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET   ?? ''
const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const PDF_SECRET = process.env.INTERNAL_PDF_SECRET ?? ''

// ── GET: Meta webhook verification ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response('Forbidden', { status: 403 })
}

// ── POST: Receive messages from Meta Cloud API ────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // 1. Validate X-Hub-Signature-256 (required before production)
  if (APP_SECRET) {
    const signature = req.headers.get('x-hub-signature-256') ?? ''
    const expected  = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  }

  // 2. Parse body
  let body: MetaPayload
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ ok: true })
  }

  // 3. Respond 200 immediately — Meta requires <1s
  //    Process in background with after() (runs after response is sent)
  after(async () => {
    await processIncoming(body).catch(e => console.error('[wa-meta] process error:', e))
  })

  return NextResponse.json({ ok: true })
}

// ── Background processing ─────────────────────────────────────────────────────
async function processIncoming(body: MetaPayload) {
  if (body.object !== 'whatsapp_business_account') return

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages?.length) continue

      for (const msg of value.messages) {
        // Only text messages in this stage; other types stored as [archivo]
        const wamid = msg.id
        const from  = msg.from   // phone without +
        const ts    = parseInt(msg.timestamp ?? '0') * 1000
        const text  = msg.type === 'text'
          ? (msg.text?.body ?? '')
          : `[${msg.type}]`

        if (!wamid || !from) continue

        const contact = value.contacts?.find(c => c.wa_id === from)
        const name    = contact?.profile?.name ?? ''

        await fetch(`${CRM_API}?action=wa_cloud_receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
          body: JSON.stringify({ wamid, phone: from, text, contact_name: name, ts }),
        }).catch(e => console.error('[wa-meta] store error:', e))
      }
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetaPayload {
  object: string
  entry?: Array<{
    id: string
    changes?: Array<{
      value: {
        messaging_product?: string
        messages?: Array<{
          id: string
          from: string
          timestamp?: string
          type: string
          text?: { body: string }
        }>
        contacts?: Array<{
          wa_id: string
          profile: { name: string }
        }>
      }
    }>
  }>
}
