import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { password } = await req.json()
  if (!password || password.length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 })
  await crmPost('profiles_update_password', { password }, {}, token)
  return NextResponse.json({ ok: true })
}
