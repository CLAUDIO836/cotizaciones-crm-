import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const convId = req.nextUrl.searchParams.get('conv_id')
  if (!convId) return NextResponse.json({ error: 'conv_id requerido' }, { status: 400 })
  try {
    const r = await crmGet('wa_cloud_messages', { conv_id: convId }, token)
    return NextResponse.json(r.data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
