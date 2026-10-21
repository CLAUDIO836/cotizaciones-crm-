import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const res = await fetch(`${CRM_API}?action=prospect_contact_add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      prospect_id: id,
      name: body.name,
      role: body.role || null,
      email: body.email || null,
      mobile: body.mobile || null,
    }),
  })
  const text = await res.text()
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status })
  } catch {
    console.error('[contacts POST] PHP:', text.slice(0, 300))
    return NextResponse.json({ error: text.slice(0, 200) }, { status: 502 })
  }
}
