import { NextRequest, NextResponse } from 'next/server'
import { crmPost } from '@/lib/api'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API = 'https://api.pipedrive.com/v1'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { response, responded_name, responded_rut, rejection_reason } = body

  if (!['accepted', 'rejected'].includes(response)) {
    return NextResponse.json({ error: 'response debe ser accepted o rejected' }, { status: 400 })
  }
  if (!responded_name || !responded_rut) {
    return NextResponse.json({ error: 'Nombre y RUT requeridos' }, { status: 400 })
  }
  if (response === 'rejected' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'Debes indicar el motivo del rechazo' }, { status: 400 })
  }

  try {
    const r = await crmPost('approvals_respond', { token, response, responded_name, responded_rut, rejection_reason })
    const d = r.data as Record<string, unknown>

    // Update Pipedrive if deal exists
    const dealId = (d as { pipedrive_deal_id?: string })?.pipedrive_deal_id
    if (dealId && PIPEDRIVE_TOKEN) {
      const pipeBody: Record<string, string> = { status: response === 'accepted' ? 'won' : 'lost' }
      if (response === 'rejected' && rejection_reason) pipeBody.lost_reason = rejection_reason
      await fetch(`${PIPEDRIVE_API}/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeBody),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
