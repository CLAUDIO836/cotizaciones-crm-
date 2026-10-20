import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const res = await fetch(`${CRM_API}?action=activity_create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}
