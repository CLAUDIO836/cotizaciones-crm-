import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

// Endpoint temporal E2E — crea un borrador staging para pruebas visuales.
// Usa quotations_create (JWT normal) — no depende de E2E_STAGING_TOKEN.
export async function POST() {
  const userToken = await getToken()
  if (!userToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = {
    etapa: 'borrador_wa',
    vehicle_type: 'Bus 45',
    desde: 'Las Condes, Santiago',
    hasta: 'San Bernardo, Santiago',
    desde_lat: -33.4150,
    desde_lng: -70.5869,
    hasta_lat: -33.5870,
    hasta_lng: -70.6937,
    distancia_km: 28.5,
    subtotal: 131775,
    tax_pct: 19,
    total: 156812,
    observaciones: 'Borrador de prueba E2E staging',
    items: [
      {
        codigo: 'BUS-45',
        description: 'Bus 45 pasajeros — San Bernardo',
        pasajeros: 42,
        quantity: 2,
        unit_price: 65887,
        sort_order: 1,
      },
    ],
  }

  const res = await fetch(
    `${CRM_API_STG}?action=quotations_create&token=${encodeURIComponent(userToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  )

  const data = await res.json()
  if (!res.ok) return NextResponse.json(data, { status: res.status })

  const id = data?.data?.id ?? data?.id ?? null
  return NextResponse.json({ ok: true, id, data: data?.data ?? data })
}
