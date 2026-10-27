import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET   ?? ''
const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const PDF_SECRET = process.env.INTERNAL_PDF_SECRET ?? ''

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BOT_SYSTEM = `Eres el asistente de WhatsApp de TransCCL, empresa chilena de transporte de personas en buses.

Servicios que ofrecemos:
- Transporte escolar (rutas ida y vuelta para colegios)
- Transporte de personal para empresas
- Traslados de grupos y excursiones
- Transporte turístico

Tu tarea:
- Responder consultas sobre servicios, disponibilidad y precios de forma breve y amable.
- Para cotizaciones: solicitar número de alumnos/personas, origen, destino y frecuencia.
- Para precios exactos: indicar que un ejecutivo los contactará con la cotización formal.
- Usar español informal chileno (sin exceso de slang).
- Respuestas cortas: máximo 3-4 oraciones.

Cuándo escalar a un ejecutivo humano (responde SOLO con la palabra ESCALAR):
- El cliente pide hablar con una persona
- Hay quejas o reclamos
- La consulta es muy específica y no puedes resolverla
- Llevas más de 3 intercambios sin resolver la duda

No inventes precios ni fechas. Si no sabes algo, dilo y ofrece que un ejecutivo los contacte.`

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

        const storeRes = await fetch(`${CRM_API}?action=wa_cloud_receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
          body: JSON.stringify({ wamid, phone: from, text, contact_name: name, ts }),
        }).catch(e => { console.error('[wa-meta] store error:', e); return null })

        // Run bot if bot_active and message is new (not duplicate)
        if (storeRes?.ok) {
          const storeData = await storeRes.json().catch(() => null)
          if (storeData?.bot_active && storeData?.new && msg.type === 'text') {
            await runBot(storeData.conversation_id, from).catch(e =>
              console.error('[wa-meta] bot error:', e)
            )
          }
        }
      }
    }
  }
}

// ── Bot logic ─────────────────────────────────────────────────────────────────
async function runBot(conversationId: string, phone: string) {
  // 1. Fetch last 20 messages
  const histRes = await fetch(`${CRM_API}?action=wa_cloud_history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  if (!histRes.ok) { console.error('[bot] history fetch failed'); return }
  const histData = await histRes.json()
  const history: Array<{ direction: string; content: string }> = histData?.data ?? []

  // 2. Build messages array for Claude
  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.direction === 'in' ? 'user' : 'assistant',
    content: m.content,
  }))

  // Ensure last message is from user (required by Anthropic)
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return

  // 3. Call Claude
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 400,
    system: BOT_SYSTEM,
    messages,
  })

  const reply = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text.trim() : ''
  if (!reply) return

  // 4. Check if bot should escalate
  if (reply === 'ESCALAR') {
    await fetch(`${CRM_API}?action=wa_cloud_bot_escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
      body: JSON.stringify({ conversation_id: conversationId }),
    })
    // Send notification message to client
    await fetch(`${CRM_API}?action=wa_cloud_bot_send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
      body: JSON.stringify({ phone, text: 'Un ejecutivo de TransCCL te contactará a la brevedad. ¡Gracias por comunicarte con nosotros! 🚌' }),
    })
    return
  }

  // 5. Send bot reply
  await fetch(`${CRM_API}?action=wa_cloud_bot_send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
    body: JSON.stringify({ phone, text: reply }),
  })
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
