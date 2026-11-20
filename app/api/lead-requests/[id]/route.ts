import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  await crmPost('leads_update_status', {
    id,
    status:           body.status           ?? null,
    assigned_user_id: body.assigned_user_id ?? null,
    crm_notes:        body.crm_notes        ?? null,
  }, {}, token)
  return NextResponse.json({ ok: true })
}
