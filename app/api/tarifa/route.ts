import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { TARIFARIO, calcularTarifa, type EntradaTarifa } from '@/lib/tarifario'

// GET: reglas vigentes del tarifario (para mostrar formatos y parámetros en pantalla)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, data: TARIFARIO })
}

// POST: calcula el precio de un viaje con las reglas del tarifario
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Partial<EntradaTarifa> | null
  if (!body || (body.servicio !== 'salida' && body.servicio !== 'contrato')) {
    return NextResponse.json({ error: 'servicio debe ser "salida" o "contrato"' }, { status: 400 })
  }
  if (typeof body.km !== 'number' || !Number.isFinite(body.km) || body.km < 0) {
    return NextResponse.json({ error: 'km debe ser un número mayor o igual a 0' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, data: calcularTarifa(body as EntradaTarifa) })
}
