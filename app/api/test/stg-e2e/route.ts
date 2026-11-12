/**
 * RUTA TEMPORAL DE PRUEBA E2E — staging únicamente
 * Eliminar después de completar las pruebas de staging.
 * No tiene datos sensibles: proxea al test runner en staging.
 */

import { NextRequest, NextResponse } from 'next/server'

const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? 'e2e_sofia_staging_nov2026'
const RUNNER_URL = 'https://erp.transccl.cl/crm-api.php'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (token !== E2E_TOKEN) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const action  = searchParams.get('action') ?? 'status'
  const conv_id = searchParams.get('conv_id') ?? ''
  const phone   = searchParams.get('phone') ?? ''

  const params = new URLSearchParams({ token: E2E_TOKEN, action })
  if (conv_id) params.set('conv_id', conv_id)
  if (phone)   params.set('phone', phone)

  try {
    const res = await fetch(`${RUNNER_URL}?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-token': E2E_TOKEN,
        'x-user-id': 'e2e-test-runner',
        'x-user-role': 'admin',
        'User-Agent': 'CRM-Vercel/1.0',
        'Origin': 'https://crm.transccl.cl',
      },
      next: { revalidate: 0 },
    })
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    return NextResponse.json(json, { status: res.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `fetch_error: ${message}` }, { status: 502 })
  }
}
