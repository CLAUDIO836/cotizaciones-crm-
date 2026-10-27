import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { phone, text } = await req.json()
  if (!phone || !text) return NextResponse.json({ error: 'phone y text requeridos' }, { status: 400 })
  try {
    const r = await crmPost('wa_cloud_send', { phone, text }, {}, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
