import { NextRequest, NextResponse } from 'next/server'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const res = await fetch(`${CRM_API}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  const json = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? 'Error al iniciar sesión' }, { status: res.status })
  }

  const { token, user } = json.data
  const response = NextResponse.json({ ok: true, user })
  response.cookies.set('crm_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 72, // 72 hours
    path: '/',
  })
  return response
}
