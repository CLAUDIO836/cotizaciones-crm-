import { NextResponse } from 'next/server'
import { getToken, crmGet } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const data = await crmGet('billing_pending_auth', {})
  return NextResponse.json(data)
}
