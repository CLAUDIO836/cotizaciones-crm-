import { NextRequest, NextResponse } from 'next/server'
import { getToken, crmGet, crmPost } from '@/lib/api'
import { sendViaGmail, MailAttachment } from '@/lib/gmail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

const FORMA_LABELS: Record<string, string> = {
  al_contado:          'Contado — 1 pago total',
  cincuenta_cincuenta: 'Contado — 50% + 50%',
  credito_7:           'Crédito a 7 días',
  credito_15:          'Crédito a 15 días',
  credito_30:          'Crédito a 30 días',
  credito_60:          'Crédito a 60 días',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params

    // Parse multipart form (can include file attachments)
    const formData = await req.formData()
    const formaPago   = formData.get('forma_pago')   as string
    const billingName = formData.get('billing_name') as string
    const billingRut  = formData.get('billing_rut')  as string
    const billingAddr = formData.get('billing_address') as string
    const billingGiro = formData.get('billing_giro') as string
    const notas       = formData.get('notas')        as string

    // Attachments (comprobantes)
    const attachments: MailAttachment[] = []
    const files = formData.getAll('comprobantes') as File[]
    for (const file of files) {
      if (file && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer())
        attachments.push({ filename: file.name, contentType: file.type || 'application/octet-stream', data: buf })
      }
    }

    // Fetch quotation data
    const q = await crmGet('quotations_get', { id })
    if (!q?.data) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    const deal = q.data as Record<string, unknown>

    // Get vendor's Gmail token (for sending)
    const gtRes  = await fetch(`${CRM_API}?action=quotation_vendor_gmail_token&quotation_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const gtData = await gtRes.json()
    const refreshToken = (gtData?.data as { refresh_token?: string })?.refresh_token ?? ''
    const vendorEmail  = (gtData?.data as { email?: string })?.email ?? ''
    if (!refreshToken) return NextResponse.json({ error: 'Ejecutivo no tiene Gmail conectado' }, { status: 400 })

    // Build billing email HTML
    const isCredit = formaPago?.startsWith('credito')
    const items = (deal.quotation_items as { description?: string; quantity?: number; unit_price?: number }[]) ?? []
    const itemsHtml = items.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
          <thead><tr style="background:#f3f4f6">
            <th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb">Descripción</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">Cant.</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">Precio unit.</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">Total</th>
          </tr></thead>
          <tbody>
            ${items.map(it => `<tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${it.description ?? '—'}</td>
              <td style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">${it.quantity ?? 1}</td>
              <td style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">$${Number(it.unit_price ?? 0).toLocaleString('es-CL')}</td>
              <td style="text-align:right;padding:6px 8px;border:1px solid #e5e7eb">$${((it.quantity ?? 1) * (it.unit_price ?? 0)).toLocaleString('es-CL')}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:#6b7280;font-size:13px">Sin ítems registrados</p>'

    const totalFmt = `$${Number(deal.total ?? 0).toLocaleString('es-CL')}`

    const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
  <div style="background:#1B8A4B;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:white;margin:0;font-size:18px">✅ Negocio ganado – Solicitud de facturación</h2>
    <p style="color:#bbf7d0;margin:4px 0 0;font-size:13px">Negocio #${deal.number} · ${deal.client_name ?? deal.company ?? ''}</p>
  </div>
  <div style="background:#f9fafb;padding:20px 24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">

    <h3 style="font-size:14px;color:#374151;margin:0 0 12px">📋 Datos de facturación</h3>
    <table style="font-size:13px;width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;width:140px;padding:3px 0">Razón social:</td><td><strong>${billingName || (deal.client_name as string) || '—'}</strong></td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">RUT:</td><td><strong>${billingRut || (deal.client_rut as string) || '—'}</strong></td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">Dirección:</td><td>${billingAddr || (deal.client_address as string) || '—'}</td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">Giro:</td><td>${billingGiro || '—'}</td></tr>
    </table>

    <h3 style="font-size:14px;color:#374151;margin:16px 0 12px">💳 Forma de pago</h3>
    <p style="font-size:14px;font-weight:bold;color:${isCredit ? '#d97706' : '#1B8A4B'};margin:0">
      ${FORMA_LABELS[formaPago] ?? formaPago}
      ${isCredit ? ' ⚠️ <span style="color:#d97706;font-weight:normal;font-size:12px">(Requiere autorización de gerencia)</span>' : ''}
    </p>

    <h3 style="font-size:14px;color:#374151;margin:16px 0 8px">📦 Servicios / Ítems</h3>
    ${itemsHtml}

    <table style="font-size:13px;width:100%;border-collapse:collapse;margin-top:4px">
      <tr><td style="text-align:right;color:#6b7280;padding:3px 0">Subtotal:</td><td style="text-align:right;width:120px">$${Number(deal.subtotal ?? 0).toLocaleString('es-CL')}</td></tr>
      <tr><td style="text-align:right;color:#6b7280;padding:3px 0">IVA (${deal.tax_pct ?? 19}%):</td><td style="text-align:right">$${(Number(deal.subtotal ?? 0) * Number(deal.tax_pct ?? 19) / 100).toLocaleString('es-CL')}</td></tr>
      <tr style="font-weight:bold"><td style="text-align:right;padding:4px 0;border-top:2px solid #e5e7eb;color:#1B8A4B">TOTAL:</td><td style="text-align:right;border-top:2px solid #e5e7eb;color:#1B8A4B">${totalFmt}</td></tr>
    </table>

    ${notas ? `<div style="background:#fffbeb;border:1px solid #fde68a;padding:10px 12px;border-radius:6px;margin-top:16px"><p style="margin:0;font-size:13px;color:#92400e">📝 <strong>Notas:</strong> ${notas}</p></div>` : ''}

    ${attachments.length === 0 && !isCredit ? `<div style="background:#fef3c7;border:1px solid #fcd34d;padding:10px 12px;border-radius:6px;margin-top:12px"><p style="margin:0;font-size:13px;color:#92400e">⚠️ No se adjuntaron comprobantes de pago. El ejecutivo los enviará por separado.</p></div>` : ''}

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;color:#9ca3af;margin:0">Enviado por: ${vendorEmail} · TransCCL CRM</p>
  </div>
</div>`

    // Send email to contabilidad
    await sendViaGmail({
      refreshToken,
      from:        vendorEmail,
      to:          'contabilidad@transccl.cl',
      cc:          vendorEmail,
      subject:     `Solicitud factura – Negocio #${deal.number} – ${deal.client_name ?? deal.company ?? ''}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    // Mark as won
    await crmPost('quotations_set_status', { id, status: 'won' }, {}, token)

    // Save billing info to DB
    await crmPost('quotation_save_billing', {
      quotation_id: id,
      forma_pago:   formaPago,
      billing_name: billingName,
      billing_rut:  billingRut,
      billing_address: billingAddr,
      billing_giro: billingGiro,
      notas,
      requires_auth: isCredit ? 1 : 0,
    }, {}, token)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[billing-won]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
