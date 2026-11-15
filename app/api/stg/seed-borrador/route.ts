import { NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''

// Endpoint temporal E2E — crea un borrador staging para pruebas visuales.
// Solo accesible con sesión activa. No modifica producción.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const phone = '56911111002'

  // Intentar limpiar conversación existente primero (idempotente)
  try {
    await fetch(`${CRM_API_STG}?action=e2e_reset_conv&phone=${phone}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-e2e-token': E2E_TOKEN },
      body: JSON.stringify({ phone }),
      cache: 'no-store',
    })
  } catch { /* ignorar — puede no existir */ }

  // Crear conversación + borrador
  const res = await fetch(`${CRM_API_STG}?action=e2e_seed_borrador_phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-e2e-token': E2E_TOKEN },
    body: JSON.stringify({
      phone,
      contact_name: 'Test E2E Staging',
      service_origin: 'Las Condes, Santiago',
      service_destination: 'San Bernardo, Santiago',
      service_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      service_passengers: 42,
      service_type: 'privado',
      service_vehicle: 'Bus 45',
      service_km: 28.5,
    }),
    cache: 'no-store',
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json(data, { status: res.status })

  const quotId = data.data?.borrador?.quotation_id ?? data.data?.borrador?.id ?? null
  return NextResponse.json({ ok: true, quot_id: quotId, raw: data.data?.borrador })
}
