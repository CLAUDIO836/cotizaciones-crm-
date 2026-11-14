import { NextRequest, NextResponse } from 'next/server'
import { calcularTarifa, type EntradaTarifa } from '@/lib/tarifario'

// Internal endpoint for PHP processes (wa_form_save, crear_borrador_wa).
// Auth: X-Internal-Secret header = INTERNAL_PDF_SECRET env var.
// No session required — only for server-to-server calls.

const SECRET = process.env.INTERNAL_PDF_SECRET ?? ''

export async function POST(req: NextRequest) {
  const incoming = req.headers.get('x-internal-secret') ?? ''
  if (!SECRET || incoming !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as Partial<EntradaTarifa> | null
  if (!body || (body.servicio !== 'salida' && body.servicio !== 'contrato')) {
    return NextResponse.json({ error: 'servicio debe ser "salida" o "contrato"' }, { status: 400 })
  }
  if (typeof body.km !== 'number' || !Number.isFinite(body.km) || body.km < 0) {
    return NextResponse.json({ error: 'km debe ser un número mayor o igual a 0' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, data: calcularTarifa(body as EntradaTarifa) })
}
