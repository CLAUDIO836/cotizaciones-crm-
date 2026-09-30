import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'
import { fetchAiConversation } from '@/lib/ai-api'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `Eres el asistente comercial de Transccl, empresa de transporte terrestre en Chile especializada en servicios de bus para empresas, colegios y eventos.

Tu misión es ayudar al equipo de ventas redactando respuestas profesionales, cálidas y persuasivas a clientes potenciales.

Cuando redactes una respuesta:
- Sé conciso y directo al punto
- Muestra interés genuino en las necesidades del cliente
- Si tienes información del lead (ruta, pasajeros, fechas), úsala de forma natural en la respuesta
- Si falta información clave para cotizar (fechas, cantidad de pasajeros, ruta exacta), pídela de forma amable
- Propone siempre un siguiente paso concreto: cotización, llamada o reunión
- Usa un tono profesional pero cercano, en español
- Firma como "Equipo Comercial Transccl"

Responde ÚNICAMENTE con el cuerpo del mensaje. Sin asunto, sin explicaciones adicionales.`

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversation_id } = await req.json()
  if (!conversation_id) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })
  }

  const conv = await fetchAiConversation(conversation_id, token)
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Build lead context
  const lines: string[] = []
  if (conv.empresa_nombre) lines.push(`Empresa: ${conv.empresa_nombre}`)
  if (conv.contacto_nombre) lines.push(`Contacto: ${conv.contacto_nombre}`)
  if (conv.tipo_servicio)   lines.push(`Servicio: ${conv.tipo_servicio}`)
  if (conv.desde && conv.hasta) lines.push(`Ruta: ${conv.desde} → ${conv.hasta}`)
  else if (conv.desde)      lines.push(`Origen: ${conv.desde}`)
  else if (conv.hasta)      lines.push(`Destino: ${conv.hasta}`)
  if (conv.pasajeros_aprox) lines.push(`Pasajeros aprox: ${conv.pasajeros_aprox}`)
  if (conv.fecha_inicio)    lines.push(`Fecha inicio: ${conv.fecha_inicio}`)
  if (conv.observaciones)   lines.push(`Observaciones: ${conv.observaciones}`)
  if (!conv.empresa_nombre && conv.client_name) lines.push(`Cliente: ${conv.client_name}`)

  const sentMessages = conv.messages.filter(
    m => m.message_type !== 'draft' && m.sender !== 'system'
  )

  const historial = sentMessages.length > 0
    ? sentMessages.map(m => `[${m.sender === 'client' ? 'Cliente' : 'Agente'}]: ${m.content}`).join('\n')
    : 'Sin mensajes previos — primer contacto.'

  const userPrompt = [
    lines.length > 0 ? `CONTEXTO DEL LEAD:\n${lines.join('\n')}` : null,
    `HISTORIAL:\n${historial}`,
    'Redacta una respuesta profesional y persuasiva para avanzar hacia la cotización o cierre.',
  ].filter(Boolean).join('\n\n')

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!content) throw new Error('Claude no devolvió texto')

    const idempotencyKey = `draft-${conversation_id}-${Date.now()}`
    const r = await crmPost(
      'ai_messages_upsert_draft',
      { conversation_id, content, idempotency_key: idempotencyKey },
      {},
      token
    )
    return NextResponse.json(r.data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
