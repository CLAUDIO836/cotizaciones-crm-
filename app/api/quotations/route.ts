import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PD_BASE  = 'https://api.pipedrive.com/v1'

async function syncToPipedrive(action: string, dealId: string, status?: string) {
  if (!PD_TOKEN || !dealId) return
  try {
    if (action === 'delete') {
      await fetch(`${PD_BASE}/deals/${dealId}?api_token=${PD_TOKEN}`, { method: 'DELETE' })
    } else if (action === 'set_status') {
      // Pipedrive API v1 usa PUT (no PATCH) para actualizar deals
      await fetch(`${PD_BASE}/deals/${dealId}?api_token=${PD_TOKEN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    }
  } catch (e) {
    console.error('[PD Sync] error:', e)
  }
}

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
  try {
    const r = await crmPost(action, body, {}, token)
    // Sync to Pipedrive after successful CRM update
    if (body.pipedrive_deal_id) {
      await syncToPipedrive(body._action, body.pipedrive_deal_id, body.status)
    }
    return NextResponse.json(r.data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
