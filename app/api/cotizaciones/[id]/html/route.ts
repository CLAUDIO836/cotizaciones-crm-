import { createClient } from '@/lib/supabase/server'
import { formatCLP, formatDate } from '@/lib/utils'

function fmtDateTime(val: string | null | undefined) {
  if (!val) return '—'
  return new Date(val).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const VEHICLE_IMAGES_CCL: Record<string, string> = {
  'bus':     '/vehicles/bus-real.png',
  'taxibus': '/vehicles/taxibus-real.png',
  'minibus': '/vehicles/minibus-real.png',
  'minivan': '/vehicles/minivan-real.png',
}

const VEHICLE_IMAGES_TKS: Record<string, string> = {
  'bus':     '/vehicles/tks-bus.jpg',
  'taxibus': '/vehicles/tks-taxibus.jpg',
  'minibus': '/vehicles/tks-minibus.jpg',
  'minivan': '/vehicles/minivan.jpg',
}

const VEHICLE_LABELS: Record<string, string> = {
  'bus':     'Bus (40–60 pasajeros)',
  'taxibus': 'Taxibús (25–33 pasajeros)',
  'minibus': 'Minibús (14–19 pasajeros)',
  'minivan': 'Minivan (7–10 pasajeros)',
}

const TKS_POLICIES = [
  { title: 'Confirmación de Cotización', desc: 'Una vez aceptada la cotización, el cliente deberá confirmarla por correo electrónico dirigido a su asesor comercial. No se podrán modificar horarios, comunas, regiones o países establecidos.' },
  { title: 'Reserva y Pago del Servicio', desc: 'Para concluir la reserva, el cliente deberá enviar copia de transferencia del 50% del total. El 50% restante debe cancelarse antes del inicio del servicio. Depósitos deben enviarse a contabilidad@transportestks.com.' },
  { title: 'Carta de Aprobación', desc: 'La carta de aprobación debe enviarse con al menos 24 horas de anticipación. No se aceptarán cambios con menos de 48 horas. La carta valida el servicio pero no constituye reserva.' },
  { title: 'Garantía de Servicio', desc: 'Al contratar con TKS, el cliente accede a vehículos de contingencia en caso de imprevistos y cambio de unidad si no se cumple lo comprometido.' },
  { title: 'Retrasos del Usuario', desc: 'Si el usuario retrasa la salida más de 30 min, se cobrará una hora adicional: Van (7–19 pax): $15.000/hr. Minibuses y buses (24+ pax): $25.000/hr. No aplica a servicios promocionales.' },
  { title: 'Suspensión del Servicio', desc: 'Suspensión con menos de 48 horas: no se devuelve el abono del 50%. Suspensión el mismo día: el cliente cancela el 100% del servicio contratado.' },
  { title: 'Responsabilidad sobre Pertenencias', desc: 'Todas las pertenencias y objetos de valor son responsabilidad exclusiva del cliente. TKS no se hace responsable por pérdidas o daños.' },
  { title: 'Observaciones', desc: 'El cliente podrá realizar observaciones al momento de la llegada del vehículo. Una vez iniciado el servicio, no se aceptarán reclamos.' },
  { title: 'Devoluciones', desc: 'No se realizan devoluciones de dinero. Cualquier saldo a favor de TKS se abonará a un próximo servicio.' },
  { title: 'Prestación de Servicios', desc: 'TKS cuenta con vehículos propios y externos de socios estratégicos en contrato, alineados a prestar el servicio en las condiciones comprometidas.' },
  { title: 'Opiniones y Reclamos', desc: 'El cliente podrá enviar comentarios a oirs@transportestks.com. La empresa responderá en un plazo máximo de 3 días hábiles.' },
]

const CCL_POLICIES = [
  { title: 'Condiciones Generales', desc: 'Si el cliente tiene crédito vigente, las órdenes de compra deben emitirse al mismo RUT y giro de esta cotización. Si no tiene crédito, debe reservar con el 50% del total. El saldo se cancela antes de la salida del servicio.' },
  { title: 'Exención de IVA', desc: 'Transccl es una empresa de transporte exenta de IVA. El valor indicado en la cotización corresponde al total final a pagar.' },
  { title: 'Vigencia de la Cotización', desc: 'La cotización es válida por 15 días corridos desde la fecha de emisión. La Carta de Aprobación enviada por correo valida la aceptación.' },
  { title: 'Alcance Territorial', desc: 'Los precios aplican dentro y fuera del cordón Américo Vespucio siempre que el servicio se mantenga en Santiago. Para traslados fuera de Santiago se requiere cotización adicional.' },
  { title: 'Outsourcing de Traslados', desc: 'Transccl garantiza el servicio mediante Outsourcing de Transporte, con vehículos propios y socios estratégicos bajo nuestros estándares de calidad y seguridad.' },
  { title: 'Garantía de Servicio', desc: 'Incluye: Vehículos de contingencia en caso de imprevistos. Cambio de unidad si la designada no cumple lo comprometido. Supervisión activa de tráfico en tiempo real.' },
  { title: 'Uso del Servicio', desc: 'El servicio solo podrá ser solicitado por el Coordinador Titular o Suplente designado en el contrato. Prestaciones adicionales deberán ser cotizadas y aprobadas previamente.' },
  { title: 'Plazos de Pago', desc: 'El plazo de pago de la factura será a convenir con cada institución contratante, previa aprobación de la Gerencia de Transccl.' },
  { title: 'Confidencialidad', desc: 'Toda la información de esta cotización y documentos asociados es confidencial, aun cuando no se formalice contrato entre las partes.' },
  { title: 'Normativa Aplicable', desc: 'Transccl opera bajo la Normativa Decreto Nº 80 del Ministerio de Transporte, garantizando seguridad y cumplimiento en cada traslado.' },
]

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const baseUrl = new URL(req.url).origin
  const { id } = await params
  const supabase = await createClient()

  const { data: q } = await supabase
    .from('quotations')
    .select('*, clients(name, rut, email, phone, address, contacto, telefono_fijo, telefono_celular), profiles(name, celular, email), quotation_items(*), companies(name)')
    .eq('id', id)
    .single()

  if (!q) return new Response('Not found', { status: 404 })

  const isTKS = (q.companies as {name?: string})?.name === 'Transportes TKS'
  const ACCENT = isTKS ? '#C8102E' : '#1B8A4B'
  const ACCENT_LIGHT = isTKS ? '#fef2f2' : '#dcfce7'
  const ACCENT_BORDER = isTKS ? '#fca5a5' : '#1B8A4B'

  const items = (q.quotation_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

  const vehicleImages = isTKS ? VEHICLE_IMAGES_TKS : VEHICLE_IMAGES_CCL
  const vehicleImg = q.vehicle_type && vehicleImages[q.vehicle_type] ? `${baseUrl}${vehicleImages[q.vehicle_type]}` : null
  const vehicleLabel = q.vehicle_type ? (VEHICLE_LABELS[q.vehicle_type] ?? q.vehicle_type) : null

  const subtotalNeto = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const descuentoPct = q.descuento_pct ?? 0
  const descuentoAmt = subtotalNeto * (descuentoPct / 100)
  const baseConDesc = subtotalNeto - descuentoAmt
  const iva = baseConDesc * (q.tax_pct / 100)
  const total = baseConDesc + iva

  const policies = isTKS ? TKS_POLICIES : CCL_POLICIES

  const companyName = isTKS ? 'Transportes TKS SpA' : 'Transportes Transccl SpA'
  const companyRUT = isTKS ? '35.496.7-K' : '76.282.952-3'
  const companyTagline = isTKS ? 'Transporte de personas' : 'Transporte de personas y carga'
  const logoBlock = isTKS
    ? `<div style="font-size:28px;font-weight:900;color:${ACCENT};letter-spacing:-0.02em;">TKs</div>`
    : `<img src="${baseUrl}/logo-transccl.png" alt="Transccl" style="height:56px;width:auto;object-fit:contain;" />`

  const bankBlock = isTKS ? `
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#374151;letter-spacing:0.07em;margin-bottom:8px;">Datos de transferencia para reserva (50%)</div>
    ${[
      ['Banco', 'Banco de Crédito e Inversiones (BCI)'],
      ['Swift', 'CREDCLRM'],
      ['Nombre', 'Claudio Chuhaicura López'],
      ['RUT', '14.395.747-0'],
      ['Cta. Corriente', '27975631'],
      ['Email contabilidad', 'contabilidad@transportestks.com'],
    ].map(([l, v]) => `<div style="display:flex;gap:8px;font-size:10.5px;margin-bottom:3px;"><span style="width:120px;color:#6b7280;">${l}:</span><span style="font-weight:600;">${v}</span></div>`).join('')}
  </div>` : ''

  const servicesIncluded = isTKS ? [
    'Conductor profesional certificado',
    'Asesor comercial disponible 24/7',
    'Combustible incluido en el servicio',
    'Vehículos de contingencia disponibles',
    'Control de velocidad en ruta',
    'Garantía de servicio comprometido',
  ] : [
    'Conductor profesional certificado',
    'Asesor comercial y de tráfico disponible 24/7',
    'Combustible incluido en el servicio',
    'Sistema de control y monitoreo de flota',
    'Control de velocidad en ruta',
    'Servicio integral de pasajeros',
    'Incluidos TAG y peajes',
    'Garantía de vehículos de contingencia',
    'Servicio de asistencia mecánica en ruta',
  ]

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Cotización ${q.number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 28px 32px; }
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .logo-area { display:flex; align-items:center; gap:12px; }
  .company-sub { font-size:10px; color:#6b7280; margin-top:2px; }
  .doc-block { text-align:right; }
  .doc-title { font-size:22px; font-weight:900; color:${ACCENT}; letter-spacing:0.03em; }
  .doc-num { font-size:14px; font-weight:700; color:#374151; }
  .doc-meta { font-size:11px; color:#6b7280; margin-top:3px; }
  .divider { height:3px; background:${ACCENT}; border-radius:2px; margin:14px 0; }
  .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; }
  .box-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin-bottom:8px; }
  .box-value { font-size:13px; font-weight:700; color:#111; margin-bottom:2px; }
  .box-line { font-size:11px; color:#4b5563; line-height:1.7; }
  .ruta-item label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#9ca3af; display:block; margin-bottom:2px; }
  .ruta-item span { font-size:12px; color:#111; font-weight:600; }
  .table-wrap { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  thead { background:${ACCENT}; }
  th { padding:9px 12px; text-align:left; font-size:10px; font-weight:700; color:white; text-transform:uppercase; letter-spacing:0.05em; }
  th.right, td.right { text-align:right; }
  td { padding:9px 12px; font-size:11.5px; color:#374151; border-bottom:1px solid #f3f4f6; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:nth-child(even) { background:#f9fafb; }
  .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:18px; }
  .totals { width:260px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
  .tot-row { display:flex; justify-content:space-between; padding:7px 14px; font-size:12px; border-bottom:1px solid #f3f4f6; }
  .tot-row:last-child { border-bottom:none; background:${ACCENT}; }
  .tot-row:last-child span { color:white; font-size:14px; font-weight:800; }
  .tot-label { color:#6b7280; }
  .tot-val { font-weight:600; color:#111; }
  .obs-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:12px 14px; margin-bottom:16px; }
  .obs-title { font-size:9px; font-weight:700; text-transform:uppercase; color:#92400e; letter-spacing:0.07em; margin-bottom:6px; }
  .obs-text { font-size:11.5px; color:#78350f; line-height:1.6; white-space:pre-wrap; }
  .cond-title { font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; letter-spacing:0.06em; margin-bottom:8px; padding-bottom:4px; border-bottom:2px solid ${ACCENT}; }
  .footer { border-top:2px solid ${ACCENT}; margin-top:16px; padding-top:12px; display:flex; justify-content:space-between; align-items:flex-start; }
  .footer-left { font-size:10px; color:#9ca3af; line-height:1.6; }
  .footer-right { text-align:right; font-size:10px; color:#9ca3af; }
  .validity-badge { display:inline-block; background:${ACCENT_LIGHT}; border:1px solid ${ACCENT_BORDER}; border-radius:6px; padding:5px 12px; font-size:11px; font-weight:700; color:${ACCENT}; }
  .no-print { margin-bottom:20px; display:flex; gap:10px; }
  @media print {
    .no-print { display:none !important; }
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .page { padding:16px; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="no-print">
    <button onclick="window.print()"
      style="background:${ACCENT};color:white;border:none;padding:9px 20px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer">
      🖨 Imprimir / Guardar PDF
    </button>
    <button onclick="window.close()"
      style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:9px 20px;border-radius:7px;font-size:13px;cursor:pointer">
      Cerrar
    </button>
  </div>

  <div class="header">
    <div class="logo-area">
      ${logoBlock}
      <div>
        <div class="company-sub" style="font-size:11px;color:#374151;font-weight:600;">${companyName}</div>
        <div class="company-sub">RUT: ${companyRUT}</div>
        <div class="company-sub">${companyTagline}</div>
      </div>
    </div>
    <div class="doc-block">
      <div class="doc-title">COTIZACIÓN</div>
      <div class="doc-num">${q.number}</div>
      <div class="doc-meta">Fecha: ${formatDate(q.issue_date)}</div>
      ${q.expiry_date ? `<div class="doc-meta">Válido hasta: ${formatDate(q.expiry_date)}</div>` : ''}
    </div>
  </div>
  <div class="divider"></div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
    <div class="box">
      <div class="box-title">Cliente</div>
      <div class="box-value">${q.clients?.name ?? '—'}</div>
      ${q.clients?.rut ? `<div class="box-line">RUT: <strong>${q.clients.rut}</strong></div>` : ''}
      ${q.clients?.contacto ? `<div class="box-line">Contacto: ${q.clients.contacto}</div>` : ''}
      ${(q.clients as {telefono_fijo?: string})?.telefono_fijo ? `<div class="box-line">Fijo: ${(q.clients as {telefono_fijo?: string}).telefono_fijo}</div>` : ''}
      ${(q.clients as {telefono_celular?: string})?.telefono_celular ? `<div class="box-line">Celular: ${(q.clients as {telefono_celular?: string}).telefono_celular}</div>` : ''}
      ${q.clients?.email ? `<div class="box-line">${q.clients.email}</div>` : ''}
    </div>
    <div class="box">
      <div class="box-title">Ruta / Servicio</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="ruta-item"><label>Desde</label><span>${q.desde ?? '—'}</span></div>
        <div class="ruta-item"><label>Hasta</label><span>${q.hasta ?? '—'}</span></div>
        <div class="ruta-item"><label>Fecha salida</label><span>${fmtDateTime(q.fecha_salida)}</span></div>
        <div class="ruta-item"><label>Fecha retorno</label><span>${fmtDateTime(q.fecha_destino)}</span></div>
      </div>
    </div>
    <div class="box">
      <div class="box-title">Ejecutivo comercial</div>
      ${q.profiles?.name ? `<div class="box-value">${q.profiles.name}</div>` : ''}
      ${(q.profiles as {celular?: string})?.celular ? `<div class="box-line">📱 ${(q.profiles as {celular?: string}).celular}</div>` : ''}
      ${(q.profiles as {email?: string})?.email ? `<div class="box-line">✉ ${(q.profiles as {email?: string}).email}</div>` : ''}
      <div class="box-line" style="margin-top:6px;font-size:9px;color:#9ca3af;">${companyName}</div>
    </div>
  </div>

  ${vehicleImg ? `
  <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;display:flex;gap:0;">
    <img src="${vehicleImg}" alt="Vehículo" style="width:240px;height:140px;object-fit:cover;flex-shrink:0;" />
    <div style="padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;margin-bottom:4px;">Tipo de vehículo</div>
      <div style="font-size:14px;font-weight:700;color:${ACCENT};">${vehicleLabel}</div>
    </div>
  </div>` : ''}

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:80px">CODI</th>
          <th>DESCRIPCIÓN</th>
          <th class="right" style="width:100px">PRECIO UNIT.</th>
          <th class="right" style="width:60px">CANT.</th>
          <th class="right" style="width:110px">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: { codigo?: string; description: string; quantity: number; unit_price: number; subtotal: number }) => `
        <tr>
          <td style="font-weight:600;color:${ACCENT}">${item.codigo ?? ''}</td>
          <td>${item.description}</td>
          <td class="right">${formatCLP(item.unit_price)}</td>
          <td class="right">${item.quantity}</td>
          <td class="right" style="font-weight:700">${formatCLP(item.subtotal ?? item.quantity * item.unit_price)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="totals-wrap">
    <div class="totals">
      <div class="tot-row">
        <span class="tot-label">Subtotal neto</span>
        <span class="tot-val">${formatCLP(subtotalNeto)}</span>
      </div>
      ${descuentoPct > 0 ? `
      <div class="tot-row">
        <span class="tot-label">Descuento (${descuentoPct}%)</span>
        <span class="tot-val" style="color:#D33A2C">− ${formatCLP(descuentoAmt)}</span>
      </div>` : ''}
      <div class="tot-row">
        <span class="tot-label">IVA (${q.tax_pct}%)</span>
        <span class="tot-val">${formatCLP(iva)}</span>
      </div>
      <div class="tot-row">
        <span>TOTAL</span>
        <span>${formatCLP(total)}</span>
      </div>
    </div>
  </div>

  ${q.observaciones ? `
  <div class="obs-box">
    <div class="obs-title">Observaciones</div>
    <div class="obs-text">${q.observaciones}</div>
  </div>` : ''}

  ${bankBlock}

  <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;margin-bottom:14px;">
    <div>
      <div class="cond-title">${isTKS ? 'Términos y Condiciones' : 'Proceso de compra'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;width:28px;color:#6b7280;font-size:9px;font-weight:700;">N°</th>
            <th style="padding:6px 8px;text-align:left;width:130px;color:#6b7280;font-size:9px;font-weight:700;">POLÍTICA</th>
            <th style="padding:6px 8px;text-align:left;color:#6b7280;font-size:9px;font-weight:700;">DESCRIPCIÓN</th>
          </tr>
        </thead>
        <tbody>
          ${policies.map((p, i) => `
          <tr style="border-bottom:1px solid #f3f4f6;${i % 2 === 1 ? 'background:#fafafa;' : ''}">
            <td style="padding:5px 8px;color:${ACCENT};font-weight:700;">${i + 1}</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">${p.title}</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">${p.desc}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p style="font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic;">Si usted tiene alguna pregunta sobre esta cotización, por favor póngase en contacto con nosotros.</p>
    </div>
    <div>
      <div class="cond-title">Servicios incluidos</div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${servicesIncluded.map((s, i) => `
        <div style="padding:7px 10px;font-size:10.5px;color:#374151;display:flex;gap:7px;align-items:flex-start;${i % 2 === 1 ? 'background:#f9fafb;' : ''}border-bottom:1px solid #f3f4f6;">
          <span style="color:${ACCENT};flex-shrink:0;margin-top:1px;">✓</span>
          <span>${s}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      <strong>${isTKS ? 'Transportes TKS' : 'Transccl'}</strong> · RUT ${companyRUT}<br/>
      Documento emitido el ${new Date().toLocaleDateString('es-CL')}<br/>
      ${q.profiles?.name ? `Ejecutivo: ${q.profiles.name}` : ''}
    </div>
    <div class="footer-right">
      ${q.expiry_date
        ? `<div class="validity-badge">Válida hasta ${formatDate(q.expiry_date)}</div>`
        : ''
      }
    </div>
  </div>

</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
