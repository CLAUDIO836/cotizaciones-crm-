import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/api'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres el asistente interno del CRM de Transccl. Ayudas a los ejecutivos de ventas con dudas sobre el sistema y sobre procesos comerciales.

El CRM maneja:
- **Cotizaciones**: documentos de oferta de servicios de transporte. Tienen estados (borrador, enviada, aprobada, rechazada, contratada). Se pueden generar como PDF.
- **Contratos**: generados desde cotizaciones aprobadas. Incluyen firma digital del cliente.
- **Clientes**: personas o empresas con RUT, contacto, dirección.
- **Pipeline**: tablero Kanban (estilo PipeDrive) para seguimiento de oportunidades comerciales.
- **Solicitudes de leads**: llegadas desde la web pública, asignadas a ejecutivos para seguimiento.
- **Agenda**: actividades y recordatorios ligados a clientes o cotizaciones.
- **Reportes**: métricas de ventas, conversión, cotizaciones por período.

Los servicios de Transccl son: transporte de pasajeros, traslados corporativos, buses para eventos, servicios de minería, transporte interurbano.

Responde siempre en español, de forma concisa y útil. Si no sabes algo específico del sistema, dilo claramente. No inventes datos.`

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Bad request', { status: 400 })
  }

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
