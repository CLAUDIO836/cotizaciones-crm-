import { NextRequest, NextResponse } from 'next/server'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

const COMPANY_LABELS: Record<string, string> = {
  transccl: 'Transportes Transccl SpA',
  tks: 'Transportes TKS',
  trackingccl: 'TrackingCCL',
}
const TIPO_LABELS: Record<string, string> = {
  traslado_diario: 'Traslado Diario',
  traslado_educativo: 'Traslado Educativo',
  viaje_especial: 'Viaje Especial',
  otro: 'Otro',
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const res = await fetch(`${CRM_API}?action=leads_create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })

  const leadId = json.data?.id
  await sendEmailAlert(body, leadId)
  return NextResponse.json({ ok: true, id: leadId })
}

async function sendEmailAlert(body: Record<string, unknown>, leadId: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const company = COMPANY_LABELS[body.target_company as string] ?? body.target_company
  const tipo = TIPO_LABELS[body.tipo_servicio as string] ?? body.tipo_servicio

  const TO_MAP: Record<string, string[]> = {
    transccl: ['ventas@transccl.cl', 'claudio@transccl.cl'],
    tks: ['ventas@transportestks.com', 'claudio@transccl.cl'],
    trackingccl: ['ventas@trackingccl.cl', 'claudio@transccl.cl'],
  }
  const to = TO_MAP[body.target_company as string] ?? ['claudio@transccl.cl']
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cotizaciones-crm.vercel.app'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#1B8A4B;padding:16px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:white;margin:0;font-size:18px">🔔 Nueva solicitud de cotización</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">${company} · ${tipo}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="color:#6b7280;padding:4px 0;width:130px">Empresa</td><td style="font-weight:600">${body.empresa_nombre}</td></tr>
          ${body.contacto_nombre ? `<tr><td style="color:#6b7280;padding:4px 0">Contacto</td><td>${body.contacto_nombre}</td></tr>` : ''}
          ${body.contacto_email ? `<tr><td style="color:#6b7280;padding:4px 0">Email</td><td>${body.contacto_email}</td></tr>` : ''}
          ${body.contacto_telefono ? `<tr><td style="color:#6b7280;padding:4px 0">Teléfono</td><td>${body.contacto_telefono}</td></tr>` : ''}
          ${body.desde ? `<tr><td style="color:#6b7280;padding:4px 0">Ruta</td><td>${body.desde} → ${body.hasta ?? '—'}</td></tr>` : ''}
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="${appUrl}/solicitudes" style="background:#1B8A4B;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver en CRM →</a>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px">ID: ${leadId}</p>
      </div>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRM Transccl <noreply@transccl.cl>',
        to,
        subject: `🔔 Nueva cotización: ${body.empresa_nombre} (${tipo})`,
        html,
      }),
    })
  } catch (err) {
    console.error('Error enviando email alert:', err)
  }
}
