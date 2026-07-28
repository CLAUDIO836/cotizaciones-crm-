import { NextRequest, NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken()
    const { company_id, enabled } = await req.json()
    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    await crmPost('ai_agent_settings_upsert', { company_id, enabled }, {}, token)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
