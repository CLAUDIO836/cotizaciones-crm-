import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

// GET: list of pending WA approvals (wa_quote_approvals WHERE status='pending').
// Unlike wa_cloud_list which filters conversations by LIMIT, this queries the
// approvals table directly — no pending approval is ever invisible.
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const res = await fetch(`${CRM_API}?action=wa_approvals_list`, {
      headers: { 'x-user-id': session.id, 'x-user-role': session.role ?? '' },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
