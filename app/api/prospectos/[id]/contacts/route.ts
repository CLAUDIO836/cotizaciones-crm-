import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
    const data = JSON.parse(text)
    if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    console.error('[contacts POST] PHP returned:', text.slice(0, 300))
    return NextResponse.json({ error: 'PHP error', raw: text.slice(0, 200) }, { status: 502 })
  }
}
