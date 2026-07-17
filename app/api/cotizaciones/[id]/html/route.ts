import { createClient } from '@/lib/supabase/server'
import { formatCLP, formatDate } from '@/lib/utils'

function fmtDateTime(val: string | null | undefined) {
  if (!val) return '—'
  return new Date(val).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const VEHICLE_IMAGES: Record<string, string> = {
  'bus':     '/vehicles/bus-real.png',
  'taxibus': '/vehicles/taxibus-real.png',
  'minibus': '/vehicles/minibus-real.png',
  'minivan': '/vehicles/minivan-real.png',
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const baseUrl = new URL(req.url).origin
  const { id } = await params
  const supabase = await createClient()

  const { data: q } = await supabase
    .from('quotations')
    .select('*, clients(name, rut, email, phone, address, contacto, telefono_fijo, telefono_celular), profiles(name, celular, email), quotation_items(*)')
    .eq('id', id)
    .single()

  if (!q) return new Response('Not found', { status: 404 })

  const items = (q.quotation_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

  const VEHICLE_LABELS: Record<string, string> = {
    'bus':     'Bus (40–45 pasajeros)',
    'taxibus': 'Taxibús (25–33 pasajeros)',
    'minibus': 'Minibús (14–19 pasajeros)',
    'minivan': 'Minivan (7–11 pasajeros)',
  }
  const vehicleImg = q.vehicle_type && VEHICLE_IMAGES[q.vehicle_type] ? `${baseUrl}${VEHICLE_IMAGES[q.vehicle_type]}` : null
  const vehicleLabel = q.vehicle_type ? (VEHICLE_LABELS[q.vehicle_type] ?? q.vehicle_type) : null

  const subtotalNeto = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const descuentoPct = q.descuento_pct ?? 0
  const descuentoAmt = subtotalNeto * (descuentoPct / 100)
  const baseConDesc = subtotalNeto - descuentoAmt
  const iva = baseConDesc * (q.tax_pct / 100)
  const total = baseConDesc + iva

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Cotización ${q.number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 28px 32px; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .logo-area { display:flex; align-items:center; gap:12px; }
  .logo-img { height:56px; width:auto; object-fit:contain; }
  .company-sub { font-size:10px; color:#6b7280; margin-top:2px; }
  .doc-block { text-align:right; }
  .doc-title { font-size:22px; font-weight:900; color:#1B8A4B; letter-spacing:0.03em; }
  .doc-num { font-size:14px; font-weight:700; color:#374151; }
  .doc-meta { font-size:11px; color:#6b7280; margin-top:3px; }

  /* Divider */
  .divider { height:3px; background:#1B8A4B; border-radius:2px; margin:14px 0; }

  /* Two-col layout */
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; }
  .box-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin-bottom:8px; }
  .box-value { font-size:13px; font-weight:700; color:#111; margin-bottom:2px; }
  .box-line { font-size:11px; color:#4b5563; line-height:1.7; }

  /* Ruta box */
  .ruta-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ruta-item label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#9ca3af; display:block; margin-bottom:2px; }
  .ruta-item span { font-size:12px; color:#111; font-weight:600; }

  /* Items table */
  .table-wrap { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  thead { background:#1B8A4B; }
  th { padding:9px 12px; text-align:left; font-size:10px; font-weight:700; color:white; text-transform:uppercase; letter-spacing:0.05em; }
  th.right, td.right { text-align:right; }
  td { padding:9px 12px; font-size:11.5px; color:#374151; border-bottom:1px solid #f3f4f6; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:nth-child(even) { background:#f9fafb; }

  /* Totales */
  .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:18px; }
  .totals { width:260px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
  .tot-row { display:flex; justify-content:space-between; padding:7px 14px; font-size:12px; border-bottom:1px solid #f3f4f6; }
  .tot-row:last-child { border-bottom:none; background:#1B8A4B; }
  .tot-row:last-child span { color:white; font-size:14px; font-weight:800; }
  .tot-label { color:#6b7280; }
  .tot-val { font-weight:600; color:#111; }

  /* Observaciones */
  .obs-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:12px 14px; margin-bottom:16px; }
  .obs-title { font-size:9px; font-weight:700; text-transform:uppercase; color:#92400e; letter-spacing:0.07em; margin-bottom:6px; }
  .obs-text { font-size:11.5px; color:#78350f; line-height:1.6; white-space:pre-wrap; }

  /* Condiciones */
  .cond-section { margin-bottom:14px; }
  .cond-title { font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; letter-spacing:0.06em; margin-bottom:8px; padding-bottom:4px; border-bottom:2px solid #1B8A4B; }
  .cond-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; }
  .cond-item { font-size:10.5px; color:#4b5563; padding:3px 0; display:flex; gap:6px; }
  .cond-item::before { content:"▸"; color:#1B8A4B; flex-shrink:0; }

  /* Footer */
  .footer { border-top:2px solid #1B8A4B; margin-top:16px; padding-top:12px; display:flex; justify-content:space-between; align-items:flex-start; }
  .footer-left { font-size:10px; color:#9ca3af; line-height:1.6; }
  .footer-right { text-align:right; font-size:10px; color:#9ca3af; }
  .validity-badge { display:inline-block; background:#dcfce7; border:1px solid #1B8A4B; border-radius:6px; padding:5px 12px; font-size:11px; font-weight:700; color:#1B8A4B; }

  /* Print buttons */
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

  <!-- Botones (solo pantalla) -->
  <div class="no-print">
    <button onclick="window.print()"
      style="background:#1B8A4B;color:white;border:none;padding:9px 20px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer">
      🖨 Imprimir / Guardar PDF
    </button>
    <button onclick="window.close()"
      style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:9px 20px;border-radius:7px;font-size:13px;cursor:pointer">
      Cerrar
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <img src="${baseUrl}/logo-transccl.png" alt="Transccl" class="logo-img" />
      <div>
        <div class="company-sub" style="font-size:11px;color:#374151;font-weight:600;">Transportes Transccl SpA</div>
        <div class="company-sub">RUT: 76.282.952-3</div>
        <div class="company-sub">Transporte de personas y carga</div>
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

  <!-- Cliente + Ruta + Ejecutivo -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">

    <!-- Cliente -->
    <div class="box">
      <div class="box-title">Cliente</div>
      <div class="box-value">${q.clients?.name ?? '—'}</div>
      ${q.clients?.rut ? `<div class="box-line">RUT: <strong>${q.clients.rut}</strong></div>` : ''}
      ${q.clients?.contacto ? `<div class="box-line">Contacto: ${q.clients.contacto}</div>` : ''}
      ${(q.clients as {telefono_fijo?: string})?.telefono_fijo ? `<div class="box-line">Fijo: ${(q.clients as {telefono_fijo?: string}).telefono_fijo}</div>` : ''}
      ${(q.clients as {telefono_celular?: string})?.telefono_celular ? `<div class="box-line">Celular: ${(q.clients as {telefono_celular?: string}).telefono_celular}</div>` : ''}
      ${q.clients?.email ? `<div class="box-line">${q.clients.email}</div>` : ''}
    </div>

    <!-- Ruta -->
    <div class="box">
      <div class="box-title">Ruta / Servicio</div>
      <div class="ruta-grid">
        <div class="ruta-item"><label>Desde</label><span>${q.desde ?? '—'}</span></div>
        <div class="ruta-item"><label>Hasta</label><span>${q.hasta ?? '—'}</span></div>
        <div class="ruta-item"><label>Fecha salida</label><span>${fmtDateTime(q.fecha_salida)}</span></div>
        <div class="ruta-item"><label>Fecha retorno</label><span>${fmtDateTime(q.fecha_destino)}</span></div>
      </div>
    </div>

    <!-- Ejecutivo -->
    <div class="box">
      <div class="box-title">Ejecutivo comercial</div>
      ${q.profiles?.name ? `<div class="box-value">${q.profiles.name}</div>` : ''}
      ${(q.profiles as {celular?: string})?.celular ? `<div class="box-line">📱 ${(q.profiles as {celular?: string}).celular}</div>` : ''}
      ${(q.profiles as {email?: string})?.email ? `<div class="box-line">✉ ${(q.profiles as {email?: string}).email}</div>` : ''}
      <div class="box-line" style="margin-top:6px;font-size:9px;color:#9ca3af;">Transportes Transccl SpA</div>
    </div>

  </div>

  <!-- Imagen del vehículo -->
  ${vehicleImg ? `
  <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;display:flex;gap:0;">
    <img src="${vehicleImg}" alt="Vehículo" style="width:240px;height:140px;object-fit:cover;flex-shrink:0;" />
    <div style="padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;margin-bottom:4px;">Tipo de vehículo</div>
      <div style="font-size:14px;font-weight:700;color:#1B8A4B;">${vehicleLabel}</div>
    </div>
  </div>` : ''}

  <!-- Tabla ítems -->
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
          <td style="font-weight:600;color:#1B8A4B">${item.codigo ?? ''}</td>
          <td>${item.description}</td>
          <td class="right">${formatCLP(item.unit_price)}</td>
          <td class="right">${item.quantity}</td>
          <td class="right" style="font-weight:700">${formatCLP(item.subtotal ?? item.quantity * item.unit_price)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Totales -->
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

  <!-- Observaciones -->
  ${q.observaciones ? `
  <div class="obs-box">
    <div class="obs-title">Observaciones</div>
    <div class="obs-text">${q.observaciones}</div>
  </div>` : ''}

  <!-- Proceso de compra + Servicios (dos columnas como el PDF) -->
  <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;margin-bottom:14px;">

    <!-- Políticas de compra -->
    <div>
      <div class="cond-title">Proceso de compra</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;width:28px;color:#6b7280;font-size:9px;font-weight:700;">N°</th>
            <th style="padding:6px 8px;text-align:left;width:110px;color:#6b7280;font-size:9px;font-weight:700;">POLÍTICA</th>
            <th style="padding:6px 8px;text-align:left;color:#6b7280;font-size:9px;font-weight:700;">DESCRIPCIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">1</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Condiciones Generales</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Si el cliente tiene crédito vigente, las órdenes de compra deben emitirse al mismo RUT y giro de esta cotización, considerando el recargo pactado en su contrato. Si no tiene crédito, debe reservar con el 50% del total y enviar el contrato enviado por el asesor comercial. El saldo se cancela antes de la salida del servicio.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">2</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Exención de IVA</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Transccl es una empresa de transporte exenta de IVA. El valor indicado en la cotización corresponde al total final a pagar.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">3</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Vigencia de la Cotización</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">La cotización es válida por 15 días corridos desde la fecha de emisión. La Carta de Aprobación enviada por correo valida la aceptación. Los valores expresados aplican para clientes sin crédito a 30 días.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">4</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Alcance Territorial</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Los precios aplican dentro y fuera del cordón Américo Vespucio, siempre que el servicio se mantenga en la ciudad de Santiago. Para traslados fuera de Santiago, se requiere cotización adicional.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">5</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Outsourcing de Traslados</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Transccl garantiza el servicio mediante Outsourcing de Transporte, con vehículos propios y socios estratégicos bajo nuestros estándares de calidad y seguridad.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">6</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Garantía de Servicio</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Incluye: Vehículos de contingencia en caso de imprevistos. Cambio de unidad si la designada no cumple lo comprometido. Supervisión activa de tráfico para apoyar la operación en tiempo real.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">7</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Uso del Servicio</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">El servicio solo podrá ser solicitado por el Coordinador Titular o Suplente designado en el contrato. Prestaciones adicionales deberán ser cotizadas y aprobadas previamente.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">8</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Plazos de Pago</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">El plazo de pago de la factura será a convenir con cada institución contratante, previa aprobación de la Gerencia de Transccl.</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">9</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Confidencialidad</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Toda la información de esta cotización y documentos asociados es confidencial, aun cuando no se formalice contrato entre las partes.</td>
          </tr>
          <tr>
            <td style="padding:5px 8px;color:#1B8A4B;font-weight:700;">10</td>
            <td style="padding:5px 8px;font-weight:600;color:#111;">Normativa Aplicable</td>
            <td style="padding:5px 8px;color:#4b5563;line-height:1.5;">Transccl opera bajo la Normativa Decreto Nº 80 del Ministerio de Transporte, garantizando seguridad y cumplimiento en cada traslado.</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic;">Si usted tiene alguna pregunta sobre esta cotización, por favor póngase en contacto con nosotros.</p>
    </div>

    <!-- Servicios incluidos -->
    <div>
      <div class="cond-title">Servicios incluidos</div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${[
          'Conductor profesional certificado',
          'Asesor comercial y de tráfico disponible 24/7',
          'Combustible incluido en el servicio',
          'Sistema de control y monitoreo de flota',
          'Control de velocidad en ruta',
          'Servicio integral de pasajeros',
          'Incluidos TAG y peajes',
          'Garantía de vehículos de contingencia',
          'Servicio de asistencia mecánica en ruta',
        ].map((s, i) => `
        <div style="padding:7px 10px;font-size:10.5px;color:#374151;display:flex;gap:7px;align-items:flex-start;${i % 2 === 1 ? 'background:#f9fafb;' : ''}border-bottom:1px solid #f3f4f6;">
          <span style="color:#1B8A4B;flex-shrink:0;margin-top:1px;">✓</span>
          <span>${s}</span>
        </div>`).join('')}
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <strong>Transccl</strong> · RUT ${process.env.NEXT_PUBLIC_COMPANY_RUT ?? '76.000.000-0'}<br/>
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
