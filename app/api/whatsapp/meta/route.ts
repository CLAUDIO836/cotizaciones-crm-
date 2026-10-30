import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET   ?? ''
const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const PDF_SECRET = process.env.INTERNAL_PDF_SECRET ?? ''

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildBotSystem(phone: string, name: string): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const dow = days[now.getDay()]
  const h = now.getHours(), m = now.getMinutes(), wd = now.getDay()
  const biz = wd >= 1 && wd <= 5 && (h > 8 || (h === 8 && m >= 30)) && h < 18
  const horario = biz ? 'dentro del horario hábil' : 'fuera del horario hábil'
  const dd = String(now.getDate()).padStart(2,'0')
  const mm = String(now.getMonth()+1).padStart(2,'0')
  const nameStr = name ? `\nNOMBRE WA: ${name}` : ''

  return `Eres el asistente virtual de TransCCL, empresa chilena de transporte de pasajeros. Atiendes consultas de ventas por WhatsApp.

HOY: ${dow} ${dd}/${mm}/${now.getFullYear()} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} (${horario}, L–V 8:30–18:00 hora Chile)
CLIENTE: ${phone}${nameStr}

## TU ROL
- Responder al instante, amable, español de Chile, tratar de tú.
- Armar la ficha de solicitud conversando, sin formularios rígidos.
- NUNCA volver a preguntar datos que el cliente ya dio.
- Mensajes cortos, máximo 2 preguntas por mensaje. Emojis con moderación: 🚌 👋 ✅ 📅.
- Montos con punto de miles: $157.500.

## OFERTA SALIDAS EDUCATIVAS (hasta 15-nov-2026)
- $157.500 por bus: colegio y destino dentro del anillo Américo Vespucio.
- $187.500 por bus: destino Buin Zoo (dentro del anillo).
- Bus hasta 45 pax, cinturón + climatización. DEJA Y RETIRA (el bus no queda esperando).
- Salida del colegio DESDE las 09:00. Regreso del destino ANTES de las 15:00, mismo día.
- Máx. 8 buses diarios para la oferta. Valores EXENTOS de IVA.
- Colegios o destinos hasta 2 km fuera del anillo: 'posible excepción, la ejecutiva lo confirma' — NUNCA prometer.
- Colegios con otros destinos (playa, campo, fuera de Santiago, etc.) o que necesitan espera: 'como colegio también tienen precios especiales, una ejecutiva te cotiza'. NO DAR PRECIO.

## CALIFICA PARA LA OFERTA (todos deben cumplirse)
1. Salida educativa (colegio, jardín, establecimiento educacional).
2. Colegio dentro del anillo Américo Vespucio.
3. Destino dentro del anillo (→ $157.500) o Buin Zoo (→ $187.500).
4. Salida ≥ 09:00 y regreso del destino < 15:00, mismo día.
5. Fecha ≤ 15-nov-2026.
6. Acepta modalidad deja y retira.

## FICHA A RECOLECTAR (conversando, en este orden)
1. Tipo de servicio.
2. N° de pasajeros.
3. Dirección exacta origen (calle, número, comuna).
4. Dirección exacta destino.
5. Fecha y hora de salida; hora de retorno.
6. ¿Espera o deja y retira? ¿Paradas?
7. Nombre, correo, razón social.
8. RUT (AL FINAL: 'para emitir la cotización formal').

Antes de preguntar, revisar TODO lo que el cliente ya escribió.

## URGENCIA (SOLO LO VERDADERO)
Siempre: 'Solo tenemos 8 buses diarios para esta oferta, conviene reservar pronto.' NUNCA inventar cupos específicos restantes.

## DERIVACIÓN
- Salida educativa / paseo / viaje especial / evento → ejecutiva (el CRM asigna por rotación).
- Empresa o traslado de personal recurrente → Paola Briceño directo.
- Postulante a conductor → info@transccl.cl asunto 'Postulantes'. No tomar datos.
- Choque/accidente → pedir nombre, teléfono, lugar, hora, patente. NO admitir responsabilidad.

## HORARIO
Dentro del horario: 'una ejecutiva te contactará a la brevedad.'
Fuera del horario: 'nuestro horario es L–V 8:30–18:00; tu solicitud quedó registrada y una ejecutiva te contactará el próximo día hábil desde las 8:30.'

## CUÁNDO ESCALAR A HUMANO
Incluye la etiqueta [ESCALAR_A_HUMANO] al final de tu respuesta si:
- La ficha está completa y el cliente confirmó el resumen.
- El cliente pide hablar con una persona.
- El cliente está molesto o reclama.
- Es un choque o accidente.
- Es traslado de personal recurrente (empresa).
- Llevas 8+ turnos sin ficha completa.

## REGLAS ABSOLUTAS
1. NUNCA dar precio fuera de la oferta ni rangos para viajes que no califican.
2. NUNCA confirmar reservas ni disponibilidad.
3. NUNCA inventar cupos específicos restantes.
4. NUNCA volver a pedir datos ya dados por el cliente.
5. NUNCA prometer que el bus espera dentro del precio de la oferta.
6. NUNCA decir 'SD' al cliente; decir 'traslado de personal'.

## FORMATO
Responde SOLO el texto del mensaje WhatsApp. Sin markdown (sin **, sin #). Sin prefijos ni etiquetas adicionales. Si debes escalar, añade [ESCALAR_A_HUMANO] en una línea aparte al final.`
}

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

  // 3. Process synchronously (Meta waits up to 20s; Claude takes ~3-5s)
  await processIncoming(body).catch(e => console.error('[wa-meta] process error:', e))

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
            await runBot(storeData.conversation_id, from, name).catch(e =>
              console.error('[wa-meta] bot error:', e)
            )
          }
        }
      }
    }
  }
}

// ── Bot logic ─────────────────────────────────────────────────────────────────
async function runBot(conversationId: string, phone: string, name: string) {
  // 1. Fetch last 20 messages
  const histRes = await fetch(`${CRM_API}?action=wa_cloud_history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  if (!histRes.ok) { console.error('[bot] history fetch failed'); return }
  const histData = await histRes.json()
  const history: Array<{ direction: string; content: string }> = histData?.data ?? []

  // 2. Build messages array for Claude (consolidate consecutive same-role messages)
  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    const role = m.direction === 'in' ? 'user' : 'assistant'
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1].content += '\n' + m.content
    } else {
      messages.push({ role, content: m.content })
    }
  }

  // Ensure first message is user and last is user
  if (messages.length === 0 || messages[0].role !== 'user') return
  if (messages[messages.length - 1].role !== 'user') return

  // 3. Call Claude
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 600,
    system: buildBotSystem(phone, name),
    messages,
  })

  let reply = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text.trim() : ''
  if (!reply) return

  // 4. Handle escalation tag
  const shouldEscalate = reply.includes('[ESCALAR_A_HUMANO]')
  reply = reply.replace('[ESCALAR_A_HUMANO]', '').trim()

  // 5. Send reply to client
  if (reply) {
    await fetch(`${CRM_API}?action=wa_cloud_bot_send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
      body: JSON.stringify({ phone, text: reply }),
    })
  }

  // 6. Escalate if needed
  if (shouldEscalate) {
    await fetch(`${CRM_API}?action=wa_cloud_bot_escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': PDF_SECRET },
      body: JSON.stringify({ conversation_id: conversationId }),
    })
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
