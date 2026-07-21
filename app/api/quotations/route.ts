import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (body._action === 'create_contract') {
    await crmPost('contracts_create', {
      quotation_id: body.quotation_id,
      client_id: body.client_id,
      user_id: body.user_id,
      value: body.value,
      start_date: new Date().toISOString().split('T')[0],
    }, {}, token)
    return NextResponse.json({ ok: true })
  }

  const action = body._action === 'delete' ? 'quotations_delete'
    : body._action === 'set_status' ? 'quotations_set_status'
    : body._action === 'set_etapa' ? 'quotations_set_etapa'
    : body.id ? 'quotations_update'
    : 'quotations_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r.data)
}
