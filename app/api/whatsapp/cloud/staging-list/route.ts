import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''

// Devuelve las conversaciones staging con borrador pendiente de aprobación.
// El aislamiento staging se garantiza en el backend vía credenciales separadas (stg()).
// El token E2E se inyecta server-side — el navegador nunca lo ve.
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const res = await fetch(`${CRM_API}?action=e2e_convs_pending_approval`, {
      headers: {
        'x-e2e-token': E2E_TOKEN,
        'x-user-id':   session.id,
        'x-user-role': session.role ?? '',
      },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json(data, { status: res.status })
    return NextResponse.json(Array.isArray(data.convs) ? data.convs : [])
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
