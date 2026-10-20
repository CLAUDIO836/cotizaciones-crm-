import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

async function call(token: string, action: string, body: unknown) {
  const res = await fetch(`${CRM_API}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return call(token, 'commune_assignments_save', await req.json())
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return call(token, 'commune_assignments_delete', await req.json())
}
