import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''

// Decide (aprobar/rechazar) un borrador en staging.
// El token E2E se inyecta server-side. El backend valida rol gerencia/supervisor.
// Ningún mensaje real se envía por WhatsApp — solo registra la decisión en staging DB.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const res = await fetch(`${CRM_API}?action=e2e_approvals_decide_stg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-token': E2E_TOKEN,
        'x-user-id':   session.id,
        'x-user-role': session.role ?? '',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
