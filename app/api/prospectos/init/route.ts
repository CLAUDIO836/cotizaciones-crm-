import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const res = await fetch(`${CRM_API}?action=prospectos_init&token=${encodeURIComponent(token)}`, { method: 'POST' })
  return NextResponse.json(await res.json(), { status: res.status })
}
