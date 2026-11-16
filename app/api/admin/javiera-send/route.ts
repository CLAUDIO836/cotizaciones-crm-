import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { buildQuotationEmailHtml } from '@/lib/email'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

// Datos conocidos de Javiera
const JAVIERA = {
  convId:      '4ac43637-e14b-11f1-adc3-56000529c2a9',
  quotationId: '996fb3b7-e14b-11f1-adc3-56000529c2a9',
  email:       'javmp13@gmail.com',
  name:        'Javiera Muñoz Pinochet',
  cartaUrl:    'https://crm.transccl.cl/firmar/9a23c419-e1e1-11f1-adc3-56000529c2a9',
  quoteNumber: '47291',
  total:       287500,
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado v2' }, { status: 401 })

  const tokenParam = `&token=${encodeURIComponent(token)}`
  const results: Record<string, unknown> = { token_ok: true }

  try {
    const { only } = await req.json().catch(() => ({ only: null }))

    // ── Email ──────────────────────────────────────────────────────────────
    if (!only || only === 'email') {
      const resendKey = process.env.RESEND_API_KEY
      if (!resendKey) {
        results.email = { error: 'RESEND_API_KEY no disponible' }
      } else {
        const html = buildQuotationEmailHtml({
          clientName:      JAVIERA.name,
          clientEmail:     JAVIERA.email,
          quotationNumber: JAVIERA.quoteNumber,
          total:           JAVIERA.total,
          cartaUrl:        JAVIERA.cartaUrl,
        })
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'CRM Transccl <noreply@transccl.cl>',
            to:      [JAVIERA.email],
            subject: `Tu cotización de TransCCL está lista — ${JAVIERA.quoteNumber}`,
            html,
          }),
        })
        const rData = await r.json()
        results.email = { ok: r.ok, status: r.status, data: rData }
      }
    }

    // ── WhatsApp ───────────────────────────────────────────────────────────
    if (!only || only === 'wa') {
      const waRes = await fetch(`${CRM_API}?action=wa_quote_retry${tokenParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: JAVIERA.convId }),
      })
      const waData = await waRes.json()
      results.wa = { ok: waRes.ok, status: waRes.status, data: waData }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
