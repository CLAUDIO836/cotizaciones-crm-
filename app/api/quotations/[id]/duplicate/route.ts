import { NextRequest, NextResponse } from 'next/server'
import { getToken, crmGet, crmPost } from '@/lib/api'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params

    // Fetch original
    const orig = await crmGet('quotations_get', { id }, token)
    if (!orig?.data) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    const q = orig.data as Record<string, unknown>
    const items = (q.quotation_items as Record<string, unknown>[]) ?? []

    // Build clone payload — nueva cotización en estado open/lead, sin fecha de servicio
    const payload = {
      status:        'open',
      etapa:         'lead',
      company:       q.company,
      company_id:    q.company_id,
      issue_date:    new Date().toISOString().split('T')[0],
      expiry_date:   null,
      subtotal:      q.subtotal,
      tax_pct:       q.tax_pct,
      total:         q.total,
      notes:         q.notes ?? null,
      terms:         q.terms ?? null,
      desde:         q.desde ?? null,
      hasta:         q.hasta ?? null,
      desde_lat:     q.desde_lat ?? null,
      desde_lng:     q.desde_lng ?? null,
      hasta_lat:     q.hasta_lat ?? null,
      hasta_lng:     q.hasta_lng ?? null,
      distancia_km:  q.distancia_km ?? null,
      fecha_salida:  null,   // ejecutivo la define en el nuevo negocio
      hora_salida:   null,
      fecha_retorno: null,
      hora_retorno:  null,
      user_id:       q.user_id,
      client_id:     q.client_id,
      pipeline_id:   q.pipeline_id ?? null,
      vehicle_type:  q.vehicle_type ?? null,
      observaciones: q.observaciones ?? null,
      contact_id:    q.contact_id ?? null,
      descuento_pct: q.descuento_pct ?? 0,
      items: items.map((it, i) => ({
        codigo:      it.codigo ?? null,
        description: it.description,
        pasajeros:   it.pasajeros ?? null,
        quantity:    it.quantity ?? 1,
        unit_price:  it.unit_price ?? 0,
        subtotal:    it.subtotal ?? 0,
        sort_order:  i,
      })),
    }

    const created = await crmPost('quotations_create', payload, {}, token)
    if (!created?.data) return NextResponse.json({ error: 'Error al duplicar' }, { status: 500 })
    return NextResponse.json({ id: (created.data as { id: string }).id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
