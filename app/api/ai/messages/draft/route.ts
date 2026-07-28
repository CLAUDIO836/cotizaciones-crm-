import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

// Phase 1: local draft simulator.
// Phase 2: will proxy to Python microservice on Railway.

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversation_id, context } = await req.json()
  if (!conversation_id) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })
  }

  const clientName: string = context?.empresa_nombre ?? context?.client_name ?? 'cliente'
  const service: string = context?.tipo_servicio ?? 'transporte'

  const content = `Estimado/a ${clientName},

Muchas gracias por contactarnos y por su interés en nuestros servicios de ${service}.

Hemos recibido su consulta y nos complace informarle que contamos con disponibilidad para atender su requerimiento. Nuestro equipo está revisando los detalles de su solicitud para prepararle una cotización personalizada.

¿Podría confirmar las fechas exactas y la cantidad de pasajeros para poder entregarle la información más precisa?

Quedamos atentos a su respuesta.

Equipo Comercial`

  const idempotencyKey = `draft-${conversation_id}-${Date.now()}`

  try {
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
