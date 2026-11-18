import { NextRequest, NextResponse } from 'next/server'
import { getToken, crmPost } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  try {
    const r = await crmPost('quotations_set_owner', body, {}, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
