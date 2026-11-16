import { NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET() {
  const session = await getSession()
  if (!session || !['superadmin', 'admin', 'gerencia'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = await getToken()
  const res = await fetch(`${CRM_API}?action=migrate_tipo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-CRM-Token': token } : {}),
    },
    body: '{}',
  })
  const data = await res.json()
  return NextResponse.json(data)
}
