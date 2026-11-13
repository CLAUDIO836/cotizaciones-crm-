import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

// Teléfonos de prueba staging — nunca llegan a producción DB
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''
const isStgPhone = (phone: string) => /^5691111\d{4}$/.test(phone)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const clean = phone.replace(/\D/g, '')
  if (!clean) return NextResponse.json({ error: 'phone requerido' }, { status: 400 })

  try {
    const staging = isStgPhone(clean)
    const action = staging ? 'e2e_form_get' : 'wa_form_get'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (staging) headers['x-e2e-token'] = E2E_TOKEN
    const res = await fetch(`${CRM_API}?action=${action}&phone=${clean}`, { cache: 'no-store', headers })
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
    const staging = isStgPhone(clean)
    const action = staging ? 'e2e_form_save_borrador' : 'wa_form_save'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (staging) headers['x-e2e-token'] = E2E_TOKEN
    const res = await fetch(`${CRM_API}?action=${action}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, phone: clean }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error de servidor' }, { status: 500 })
  }
}
