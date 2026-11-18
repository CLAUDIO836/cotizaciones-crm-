import { NextResponse } from 'next/server'
import { getToken, crmGet } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const r = await crmGet('profiles_list', {}, token)
  return NextResponse.json(r.data ?? [])
}
