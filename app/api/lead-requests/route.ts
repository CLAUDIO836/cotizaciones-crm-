import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  const { data, error } = await supabase.from('lead_requests').insert({
    ...body,
    ip_address: ip,
    user_agent: userAgent,
    status: 'pendiente',
  }).select('id').single()

  if (error) {
    console.error('lead_requests insert error:', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  // Alerta por email (si hay RESEND_API_KEY configurada)
  await sendEmailAlert(body, data.id)

  return NextResponse.json({ ok: true, id: data.id })
}

async function sendEmailAlert(body: Record<string, unknown>, leadId: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const company = COMPANY_LABELS[body.target_company as string] ?? body.target_company
  const tipo = TIPO_LABELS[body.tipo_servicio as string] ?? body.tipo_servicio

  // Destinatarios por empresa
  const TO_MAP: Record<string, string[]> = {
    transccl: ['ventas@transccl.cl', 'claudio@transccl.cl'],
    tks: ['ventas@transportestks.com', 'claudio@transccl.cl'],
    trackingccl: ['ventas@trackingccl.cl', 'claudio@transccl.cl'],
  }
  const to = TO_MAP[body.target_company as string] ?? ['claudio@transccl.cl']

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#1B8A4B;padding:16px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:white;margin:0;font-size:18px">🔔 Nueva solicitud de cotización</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">${company} · ${tipo}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="color:#6b7280;padding:4px 0;width:130px">Empresa</td><td style="font-weight:600">${body.empresa_nombre}</td></tr>
          ${body.empresa_rut ? `<tr><td style="color:#6b7280;padding:4px 0">RUT</td><td>${body.empresa_rut}</td></tr>` : ''}
          <tr><td style="color:#6b7280;padding:4px 0">Contacto</td><td><strong>${body.contacto_nombre}</strong>${body.contacto_cargo ? ` · ${body.contacto_cargo}` : ''}</td></tr>
          <tr><td style="color:#6b7280;padding:4px 0">Email</td><td><a href="mailto:${body.contacto_email}">${body.contacto_email}</a></td></tr>
          <tr><td style="color:#6b7280;padding:4px 0">Teléfono</td><td><a href="tel:${body.contacto_telefono}">${body.contacto_telefono}</a></td></tr>
          ${body.desde ? `<tr><td style="color:#6b7280;padding:4px 0">Ruta</td><td>${body.desde} → ${body.hasta ?? '—'}</td></tr>` : ''}
          ${body.pasajeros_aprox ? `<tr><td style="color:#6b7280;padding:4px 0">Pasajeros</td><td>${body.pasajeros_aprox}</td></tr>` : ''}
          ${body.fecha_inicio ? `<tr><td style="color:#6b7280;padding:4px 0">Fecha inicio</td><td>${body.fecha_inicio}</td></tr>` : ''}
          ${body.observaciones ? `<tr><td style="color:#6b7280;padding:4px 0;vertical-align:top">Obs.</td><td>${body.observaciones}</td></tr>` : ''}
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/solicitudes"
             style="background:#1B8A4B;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            Ver en CRM →
          </a>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px">ID: ${leadId}</p>
      </div>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
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
