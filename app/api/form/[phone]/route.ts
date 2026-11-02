import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const clean = phone.replace(/\D/g, '')
  if (!clean) return NextResponse.json({ error: 'phone requerido' }, { status: 400 })

  try {
    const res = await fetch(`${CRM_API}?action=wa_form_get&phone=${clean}`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const clean = phone.replace(/\D/g, '')
  if (!clean) return NextResponse.json({ error: 'phone requerido' }, { status: 400 })

  try {
    const body = await req.json()
    const res = await fetch(`${CRM_API}?action=wa_form_save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, phone: clean }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
