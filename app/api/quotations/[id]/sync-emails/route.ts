import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { fetchGmailThread, searchGmailMessages } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

async function saveMessage(token: string, quotationId: string, msg: {
  messageId: string; threadId: string; from: string; to: string
  subject: string; bodyHtml: string; date: string
}, direction: string, existingIds: Set<string>) {
  if (existingIds.has(msg.messageId)) return false
  await fetch(`${CRM_API}?action=emails_save&token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quotation_id:     quotationId,
      gmail_message_id: msg.messageId,
      gmail_thread_id:  msg.threadId,
      from_email:       msg.from,
      to_email:         msg.to,
      subject:          msg.subject,
      body_html:        msg.bodyHtml,
      direction,
      sent_at:          msg.date || new Date().toISOString(),
    }),
  })
  existingIds.add(msg.messageId)
  return true
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id: quotationId } = await params
    const body = await req.json().catch(() => ({}))
    const clientEmail: string = (body.clientEmail ?? '').trim().toLowerCase()
    const createdAt:   string = (body.createdAt   ?? '').slice(0, 10) // YYYY-MM-DD

    // Refresh token del vendedor
    const gtRes  = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const gtRaw  = await gtRes.text()
    let gtData: Record<string, unknown>
    try { gtData = JSON.parse(gtRaw) } catch { return NextResponse.json({ error: `crm-api: ${gtRaw.slice(0, 200)}` }, { status: 500 }) }

    const data         = (gtData?.data ?? {}) as Record<string, string>
    const refreshToken = data.refresh_token ?? ''
    const vendorEmail  = (data.email ?? '').toLowerCase()
    if (!refreshToken) return NextResponse.json({ synced: 0 })

    // Emails existentes
    const listRes  = await fetch(`${CRM_API}?action=emails_list&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const listData = await listRes.json()
    const existing: { gmail_message_id: string; gmail_thread_id?: string }[] = listData?.data ?? []
    const existingIds = new Set(existing.map((e) => e.gmail_message_id))
    const threadIds   = [...new Set(existing.map((e) => e.gmail_thread_id).filter(Boolean))] as string[]

    let synced = 0

    // 1) Sync hilos conocidos (respuestas del cliente en hilos iniciados desde el CRM)
    for (const threadId of threadIds) {
      const messages = await fetchGmailThread(refreshToken, threadId)
      for (const msg of messages) {
        const fromLc    = msg.from.toLowerCase()
        const direction = fromLc.includes(vendorEmail) ? 'sent' : 'received'
        if (await saveMessage(token, quotationId, msg, direction, existingIds)) synced++
      }
    }

    // 2) Buscar en Gmail correos del cliente (enviados directamente fuera del CRM)
    if (clientEmail) {
      const afterPart = createdAt ? ` after:${createdAt.replace(/-/g, '/')}` : ''
      // Buscar correos enviados AL cliente O recibidos DEL cliente
      const query = `(to:${clientEmail} OR from:${clientEmail})${afterPart}`
      const found = await searchGmailMessages(refreshToken, query, 50)
      for (const msg of found) {
        const fromLc    = msg.from.toLowerCase()
        const direction = fromLc.includes(vendorEmail) ? 'sent' : 'received'
        if (await saveMessage(token, quotationId, msg, direction, existingIds)) synced++
      }
    }

    return NextResponse.json({ synced })
  } catch (e) {
    console.error('[sync-emails]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
