import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'

const PHP = process.env.APP_URL + '/crm-api.php'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const token = req.cookies.get('crm_token')?.value
  const res = await fetch(PHP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'prospect_contact_add',
      prospect_id: id,
      name: body.name,
      role: body.role || null,
      email: body.email || null,
      mobile: body.mobile || null,
    }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.ok ? 200 : 400 })
}
