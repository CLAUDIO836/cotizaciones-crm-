import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { fetchGmailThread } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id: quotationId } = await params

    // Obtener refresh token del vendedor
    const gtRes  = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const gtRaw  = await gtRes.text()
    let gtData: Record<string, unknown>
    try { gtData = JSON.parse(gtRaw) } catch { return NextResponse.json({ error: `crm-api: ${gtRaw.slice(0, 200)}` }, { status: 500 }) }

    const data         = (gtData?.data ?? {}) as Record<string, string>
    const refreshToken = data.refresh_token ?? ''
    const vendorEmail  = (data.email ?? '').toLowerCase()
    if (!refreshToken) return NextResponse.json({ synced: 0 })

    // Obtener emails existentes para este negocio
    const listRes  = await fetch(`${CRM_API}?action=emails_list&quotation_id=${encodeURIComponent(quotationId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const listData = await listRes.json()
    const existing: { gmail_message_id: string; gmail_thread_id?: string }[] = listData?.data ?? []

    const existingIds  = new Set(existing.map((e) => e.gmail_message_id))
    const threadIds    = [...new Set(existing.map((e) => e.gmail_thread_id).filter(Boolean))] as string[]

    if (threadIds.length === 0) return NextResponse.json({ synced: 0 })

    let synced = 0
    for (const threadId of threadIds) {
      const messages = await fetchGmailThread(refreshToken, threadId)
      for (const msg of messages) {
        if (existingIds.has(msg.messageId)) continue
        // Determinar dirección: si from contiene el email del vendedor → sent, si no → received
        const fromLc    = msg.from.toLowerCase()
        const direction = fromLc.includes(vendorEmail) ? 'sent' : 'received'

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
        synced++
      }
    }

    return NextResponse.json({ synced })
  } catch (e) {
    console.error('[sync-emails]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
