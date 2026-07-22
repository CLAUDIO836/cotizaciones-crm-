import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keep_id, delete_id } = await req.json()
  if (!keep_id || !delete_id || keep_id === delete_id)
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  try {
    const r = await crmPost('clients_merge', { keep_id, delete_id }, {}, token)
    return NextResponse.json({ ok: true, ...(r.data as object ?? {}) })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
