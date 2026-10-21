import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, getToken } from '@/lib/api'
import { fetchMessages } from '@/lib/evolution'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const phone      = searchParams.get('phone') ?? ''
  const prospectId = searchParams.get('prospectId') ?? ''

  // Fetch from Evolution API (messages on this device)
  const evoData = await fetchMessages(user.id, phone)
  const evoMessages = (evoData?.messages?.records ?? []).map((m: Record<string,unknown>) => {
    const msg = m as {
      key: { fromMe: boolean; id: string }
      message?: { conversation?: string; extendedTextMessage?: { text: string } }
      messageTimestamp: number
      pushName?: string
    }
    return {
      id:        msg.key.id,
      direction: msg.key.fromMe ? 'out' : 'in',
      message:   msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '',
      timestamp: msg.messageTimestamp * 1000,
      source:    'evolution',
      senderName: msg.key.fromMe ? user.name : (msg.pushName ?? 'Cliente'),
    }
  })

  // Also fetch logged messages from CRM DB
  let crmMessages: unknown[] = []
  const token = await getToken()
  if (token && prospectId) {
    const crmRes = await fetch(
      `${CRM_API}?action=get_whatsapp_messages&token=${token}&prospect_id=${prospectId}&phone=${encodeURIComponent(phone)}`,
    ).catch(() => null)
    if (crmRes?.ok) {
      const d = await crmRes.json().catch(() => ({}))
      crmMessages = d.data ?? []
    }
  }

  // Merge and deduplicate by wamid
  const seen = new Set<string>()
  const merged = [...evoMessages, ...(crmMessages as Array<{wamid?: string; id: string}>)]
    .filter(m => {
      const key = (m as {id: string}).id ?? (m as {wamid?: string}).wamid
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      const ta = (a as {timestamp?: number; created_at?: string}).timestamp ?? new Date((a as {created_at?: string}).created_at ?? 0).getTime()
      const tb = (b as {timestamp?: number; created_at?: string}).timestamp ?? new Date((b as {created_at?: string}).created_at ?? 0).getTime()
      return ta - tb
    })

  return NextResponse.json({ messages: merged })
}
