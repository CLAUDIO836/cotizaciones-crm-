import { NextRequest, NextResponse } from 'next/server'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { signed_name, signed_rut, billing_name, billing_rut, billing_address, billing_glosa } = body

  if (!signed_name || !signed_rut) {
    return NextResponse.json({ error: 'Nombre y RUT requeridos' }, { status: 400 })
  }

  try {
    const res = await fetch(`${CRM_API_STG}?action=letters_sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, signed_name, signed_rut, billing_name, billing_rut, billing_address, billing_glosa }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.error ?? `HTTP ${res.status}`
      if (msg.includes('Ya fue firmada')) return NextResponse.json({ error: 'Este documento ya fue firmado' }, { status: 409 })
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
