import { NextRequest, NextResponse } from 'next/server'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'
const WEBHOOK_SECRET = 'pd-webhook-transccl-2024'

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const res = await fetch(`${CRM_API}?action=pipedrive_webhook&secret=${WEBHOOK_SECRET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data)
}
