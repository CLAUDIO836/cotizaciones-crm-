import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

// POST /api/clients/merge  { keep_id, delete_id }
// Reasigna cotizaciones del duplicado al principal, luego elimina el duplicado
export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keep_id, delete_id } = await req.json()
  if (!keep_id || !delete_id || keep_id === delete_id)
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  try {
    // 1. Obtener cotizaciones del cliente duplicado
    const r = await crmGet('quotations_summary', { client_id: delete_id }, token)
    const quotations = (r.data as { id: string }[]) ?? []

    // 2. Reasignar cada cotización al cliente principal
    for (const q of quotations) {
      await crmPost('quotations_update', { id: q.id, client_id: keep_id }, {}, token)
    }

    // 3. Eliminar el duplicado (ahora sin cotizaciones)
    await crmPost('clients_delete', { id: delete_id }, {}, token)

    return NextResponse.json({ ok: true, reassigned: quotations.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
