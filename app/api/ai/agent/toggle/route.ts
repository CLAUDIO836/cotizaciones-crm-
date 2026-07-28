import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

// Single-tenant fallback: if no settings row exists yet, use this stable ID
const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken()
    const { company_id, enabled } = await req.json()
    const cid = company_id || DEFAULT_COMPANY_ID
    await crmPost('ai_agent_settings_upsert', { company_id: cid, enabled }, {}, token)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
