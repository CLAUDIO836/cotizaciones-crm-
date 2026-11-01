import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const r = await crmGet('profiles_list', {}, token)
    return NextResponse.json(r.data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  try {
    const r = await crmPost('profiles_create', body, {}, token)
    return NextResponse.json({ profile: r.data })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  try {
    await crmPost('profiles_update', body, {}, token)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
