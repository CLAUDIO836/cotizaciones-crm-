import { fetchQuotation } from '@/lib/api'
import { formatCLP } from '@/lib/utils'

const ACCENT = '#1B8A4B'

// Mapeo de códigos de vehículo a etiquetas
const VEHICLE_LABEL: Record<string, string> = {
  'B45': 'Bus 45 pax', 'B40': 'Bus 40 pax', 'B33': 'Bus 33 pax', 'B25': 'Bus 25 pax',
  'M19': 'Minibús 19 pax', 'M15': 'Minibús 15 pax', 'M10': 'Minibús 10 pax',
  'V10': 'Van 10 pax', 'V7': 'Van 7 pax', 'V9': 'Van 9 pax',
}

function fmtDate(val: string | null | undefined) {
  if (!val) return '—'
  const d = val.slice(0, 10).split('-')
  if (d.length !== 3) return val
  return `${d[2]}/${d[1]}/${d[0]}`
}

function vehicleLabel(codigo: string | undefined) {
  if (!codigo) return ''
  const up = codigo.toUpperCase()
  return VEHICLE_LABEL[up] ?? codigo
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const baseUrl = new URL(req.url).origin
  const { id } = await params
  const urlToken = new URL(req.url).searchParams.get('token') ?? undefined

  const q = await fetchQuotation(id, urlToken)
  if (!q) return new Response('Not found', { status: 404 })

  const items = (q.quotation_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

  const descuentoPct = q.descuento_pct ?? 0

  // Para propuesta comercial: cada ítem es una ruta diaria
  // unit_price = precio neto por servicio, quantity = días/mes (u otro multiplicador)
  // lista = precio sin descuento
  const totalMensualNeto = items.reduce((s: number, i: { quantity: number; unit_price: number }) =>
    s + i.quantity * i.unit_price, 0)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Propuesta Comercial ${q.number} — Transccl</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }

  /* ── Pages ────────────────────────────── */
  .page {
    width: 820px; margin: 0 auto;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* ── Cover ───────────────────────────── */
  .cover {
    background: #0d4f2b;
    min-height: 1060px;
    display: flex; flex-direction: column;
    align-items: flex-start; justify-content: space-between;
    padding: 0;
    color: white;
  }
  .cover-top {
    width: 100%; padding: 48px 56px 0;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .cover-logo { height: 56px; width: auto; object-fit: contain; }
  .cover-center {
    flex: 1; display: flex; flex-direction: column;
    align-items: flex-start; justify-content: center;
    padding: 80px 56px 60px;
  }
  .cover-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: #86efac; margin-bottom: 16px;
  }
  .cover-title {
    font-size: 48px; font-weight: 900; line-height: 1.1;
    letter-spacing: -0.01em; color: white; margin-bottom: 8px;
  }
  .cover-num {
    font-size: 22px; font-weight: 400; color: #86efac; margin-bottom: 32px;
  }
  .cover-divider { width: 64px; height: 4px; background: #86efac; border-radius: 2px; margin-bottom: 36px; }
  .cover-client-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #86efac; margin-bottom: 8px; }
  .cover-client-name { font-size: 22px; font-weight: 700; color: white; margin-bottom: 4px; }
  .cover-client-sub { font-size: 13px; color: #bbf7d0; }
  .cover-bottom {
    width: 100%; padding: 28px 56px;
    border-top: 1px solid rgba(134,239,172,0.2);
    display: flex; justify-content: space-between; align-items: center;
  }
  .cover-bottom-left { font-size: 11px; color: #86efac; }
  .cover-bottom-right { font-size: 11px; color: #86efac; text-align: right; }
  .cover-stripe {
    height: 6px;
    background: linear-gradient(90deg, #1B8A4B 0%, #86efac 50%, #1B8A4B 100%);
  }

  /* ── Section pages ───────────────────── */
  .section-page { padding: 56px 64px; min-height: 1060px; display: flex; flex-direction: column; }
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid ${ACCENT}; padding-bottom: 14px; margin-bottom: 36px;
  }
  .section-number {
    width: 44px; height: 44px; border-radius: 50%;
    background: ${ACCENT}; color: white;
    font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .section-title { font-size: 22px; font-weight: 800; color: #111; margin-left: 14px; flex: 1; }
  .section-logo { height: 36px; width: auto; object-fit: contain; }

  /* ── Comparison table ────────────────── */
  .cmp-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .cmp-table th { background: ${ACCENT}; color: white; padding: 9px 12px; text-align: center; font-weight: 700; }
  .cmp-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  .cmp-table tr:nth-child(even) td { background: #f9fafb; }
  .cmp-table .area-cell { font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #9ca3af; }
  .cmp-table .check-yes { color: #1B8A4B; font-weight: 700; text-align: center; }
  .cmp-table .check-no  { color: #ef4444; text-align: center; }
  .cmp-table .check-unk { color: #d97706; text-align: center; }

  /* ── Quotation section ───────────────── */
  .quot-page { padding: 40px 56px; min-height: 1060px; display: flex; flex-direction: column; }
  .quot-header {
    background: ${ACCENT}; color: white;
    padding: 28px 36px; margin: -40px -56px 36px; /* bleed to edges */
    display: flex; justify-content: space-between; align-items: center;
  }
  .quot-title-label { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #bbf7d0; margin-bottom: 6px; }
  .quot-title-num { font-size: 28px; font-weight: 900; color: white; }
  .quot-date { font-size: 11px; color: #bbf7d0; text-align: right; }

  /* Client + exec info boxes */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .info-box-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
  .info-box-name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .info-box-line { font-size: 11px; color: #4b5563; line-height: 1.7; }

  /* Routes table */
  .routes-section { margin-bottom: 24px; }
  .routes-section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: ${ACCENT};
    border-left: 4px solid ${ACCENT}; padding-left: 10px;
    margin-bottom: 8px; margin-top: 20px;
  }
  .routes-table-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .routes-table { width: 100%; border-collapse: collapse; }
  .routes-table thead { background: #111; }
  .routes-table th {
    padding: 9px 12px; text-align: left; font-size: 9.5px;
    font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .routes-table th.right, .routes-table td.right { text-align: right; }
  .routes-table td { padding: 9px 12px; font-size: 11px; color: #374151; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .routes-table tbody tr:last-child td { border-bottom: none; }
  .routes-table tbody tr:nth-child(even) { background: #f9fafb; }
  .route-desc { font-size: 10.5px; color: #374151; line-height: 1.5; }
  .vehicle-badge {
    display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0;
    color: ${ACCENT}; font-size: 10px; font-weight: 700;
    padding: 2px 8px; border-radius: 12px; white-space: nowrap;
  }
  .price-net { font-weight: 700; color: #111; font-size: 11.5px; }
  .price-list { font-size: 10px; color: #9ca3af; text-decoration: line-through; }
  .disc-badge {
    display: inline-block; background: #fef3c7; border: 1px solid #fcd34d;
    color: #92400e; font-size: 9px; font-weight: 700;
    padding: 1px 6px; border-radius: 10px;
  }

  /* Total box */
  .total-box {
    display: flex; justify-content: flex-end; margin-top: 20px; margin-bottom: 24px;
  }
  .total-inner { width: 280px; border: 2px solid ${ACCENT}; border-radius: 10px; overflow: hidden; }
  .total-row { display: flex; justify-content: space-between; padding: 9px 16px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
  .total-row:last-child { background: ${ACCENT}; border-bottom: none; }
  .total-row:last-child span { color: white; font-size: 15px; font-weight: 800; }
  .total-lbl { color: #6b7280; }
  .total-val { font-weight: 600; color: #111; }

  /* "What's included" */
  .includes-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .inc-card {
    border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px;
  }
  .inc-card-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: ${ACCENT}; margin-bottom: 10px; border-bottom: 2px solid ${ACCENT}; padding-bottom: 6px; }
  .inc-item { font-size: 10.5px; color: #374151; display: flex; gap: 7px; align-items: flex-start; margin-bottom: 6px; }
  .inc-item::before { content: "✓"; color: ${ACCENT}; font-weight: 700; flex-shrink: 0; }

  /* Policies */
  .policies-table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 20px; }
  .policies-table th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
  .policies-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .policies-table tr:last-child td { border-bottom: none; }
  .policies-table tr:nth-child(even) td { background: #fafafa; }

  /* Page footer bar */
  .page-footer {
    margin-top: auto; padding-top: 16px;
    border-top: 2px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px; color: #9ca3af;
  }

  /* KPI bubbles */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
  .kpi-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; text-align: center; }
  .kpi-num { font-size: 32px; font-weight: 900; color: ${ACCENT}; }
  .kpi-label { font-size: 10px; color: #4b5563; margin-top: 6px; line-height: 1.4; }

  /* Testimonials */
  .testimonial { background: #f9fafb; border-left: 4px solid ${ACCENT}; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; }
  .testimonial-text { font-size: 11.5px; color: #374151; line-height: 1.6; font-style: italic; margin-bottom: 6px; }
  .testimonial-author { font-size: 10px; font-weight: 700; color: ${ACCENT}; }

  /* Print */
  .no-print { margin: 0 auto 24px; max-width: 820px; display: flex; gap: 10px; padding: 0 16px; }
  @media print {
    .no-print { display: none !important; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()"
    style="background:${ACCENT};color:white;border:none;padding:10px 22px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer">
    🖨 Imprimir / Guardar PDF
  </button>
  <button onclick="window.close()"
    style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:10px 22px;border-radius:7px;font-size:13px;cursor:pointer">
    Cerrar
  </button>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 1: PORTADA -->
<div class="page">
  <div class="cover">
    <div class="cover-stripe"></div>
    <div class="cover-top">
      <img class="cover-logo" src="${baseUrl}/logo-transccl.png" alt="Transccl" />
      <div style="text-align:right;font-size:10px;color:#86efac;line-height:1.8;">
        www.transccl.cl<br/>
        +56 2 2945 5713<br/>
        ventas@transccl.cl
      </div>
    </div>

    <div class="cover-center">
      <div class="cover-label">Documento Comercial</div>
      <div class="cover-title">PROPUESTA<br/>COMERCIAL</div>
      <div class="cover-num">N° ${q.number}</div>
      <div class="cover-divider"></div>
      <div class="cover-client-label">Preparado para</div>
      <div class="cover-client-name">${q.clients?.name ?? '—'}</div>
      ${q.clients?.rut ? `<div class="cover-client-sub">RUT: ${q.clients.rut}</div>` : ''}
      ${q.clients?.contacto ? `<div class="cover-client-sub" style="margin-top:4px;">Att.: ${q.clients.contacto}</div>` : ''}
    </div>

    <div class="cover-bottom">
      <div class="cover-bottom-left">
        <strong>Transportes Transccl SpA</strong><br/>
        RUT: 76.282.952-3<br/>
        Traslado diario de pasajeros
      </div>
      <div class="cover-bottom-right">
        Fecha: ${fmtDate(q.issue_date)}<br/>
        ${q.expiry_date ? `Válido hasta: ${fmtDate(q.expiry_date)}<br/>` : ''}
        ${q.profiles?.name ? `Ejecutivo: ${q.profiles.name}` : ''}
      </div>
    </div>
    <div class="cover-stripe"></div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 2: MISIÓN Y VISIÓN -->
<div class="page">
  <div class="section-page">
    <div class="section-header">
      <div class="section-number">1</div>
      <div class="section-title">Nuestra Misión y Visión</div>
      <img class="section-logo" src="${baseUrl}/logo-transccl.png" alt="Transccl" />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:32px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${ACCENT};margin-bottom:14px;">MISIÓN</div>
        <p style="font-size:12px;color:#1a1a1a;line-height:1.75;font-style:italic;">"Estar a la vanguardia en Chile para seguir avanzando en ser líderes en el mercado del transporte privado de pasajeros, donde nuestra sigla de medición de nuestros KPI es SITPA — Servicio Integral de Transporte Profesional de Pasajeros."</p>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${ACCENT};margin-bottom:14px;">VISIÓN</div>
        <p style="font-size:12px;color:#1a1a1a;line-height:1.75;font-style:italic;">"Ser una empresa que lidere en todos los ámbitos el transporte privado de pasajeros, ocupando el conocimiento de nuestro equipo humano y profesional, apoyados del uso de las tecnologías."</p>
      </div>
    </div>

    <div style="text-align:center;padding:24px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:900;color:${ACCENT};margin-bottom:6px;">SITPA</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:12px;">Servicio Integral de Transporte Profesional de Pasajeros</div>
      <p style="font-size:11.5px;color:#374151;line-height:1.7;max-width:560px;margin:0 auto;">"Lo importante de nuestro viaje son nuestro equipo humano y nuestros clientes. Para que el cliente y nuestro equipo siempre vivan una experiencia de viajar cómodos y seguros."</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
      ${[
        ['S', 'Servicio', 'Entregas a nuestros colaboradores herramientas adecuadas para el desempeño de sus labores'],
        ['I', 'Integral', 'Incorporamos todos los elementos que componen el transporte: taller, combustible, tecnología, personal'],
        ['T', 'Transporte', 'Más de 13 años de experiencia con todas las marcas del mercado, filtrando lo mejor del rubro'],
        ['PA', 'Pasajeros', 'Todo nuestro trabajo garantiza un servicio de primera necesidad con los más altos estándares de calidad'],
      ].map(([abbr, word, desc]) => `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:${ACCENT};margin-bottom:4px;">${abbr}</div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#374151;margin-bottom:8px;">${word}</div>
          <div style="font-size:10px;color:#6b7280;line-height:1.5;">${desc}</div>
        </div>
      `).join('')}
    </div>

    <div class="page-footer">
      <span>Transccl SpA · RUT 76.282.952-3 · Transporte privado de pasajeros</span>
      <span>Propuesta Comercial N° ${q.number}</span>
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 3: ¿POR QUÉ ELEGIRNOS? -->
<div class="page">
  <div class="section-page">
    <div class="section-header">
      <div class="section-number">2</div>
      <div class="section-title">¿Por qué elegirnos?</div>
      <img class="section-logo" src="${baseUrl}/logo-transccl.png" alt="Transccl" />
    </div>

    <table class="cmp-table">
      <thead>
        <tr>
          <th style="text-align:left;width:120px;">ÁREA</th>
          <th style="text-align:left;">SERVICIOS</th>
          <th style="width:110px;">TRANSCCL</th>
          <th style="width:110px;">COMPETENCIA</th>
        </tr>
      </thead>
      <tbody>
        ${[
          ['COMERCIAL', 'Precio del servicio', '✓', '✓'],
          ['', 'Contrato Flex', '✓', '✗'],
          ['', 'KAM (Key Account Manager)', '✓', '?'],
          ['', 'Mesa de ayuda al usuario', '✓', '✗'],
          ['', 'Asesoramiento en ruta', '✓', '?'],
          ['', 'KPI´s de medición', '✓', '✗'],
          ['', 'Optimización de servicios', '✓', '?'],
          ['', 'Evaluación anual y semestral', '✓', '✗'],
          ['VEHÍCULO', 'TAG + Combustible + Peaje', '✓', '?'],
          ['', 'GPS y control de velocidad', '✓', '?'],
          ['', 'Aire acondicionado / Calefacción', '✓', '?'],
          ['', 'Decreto N°80 (Santiago)', '✓', '?'],
          ['PLAN CONTINGENCIA', 'Vehículo de reemplazo', '✓', '?'],
          ['', 'Asistencia en ruta 24/7', '✓', '?'],
          ['', 'Conductor de reemplazo', '✓', '?'],
          ['TALLER', 'Mantención preventiva y correctiva', '✓', '?'],
          ['', 'Checklist diario / semanal / mensual', '✓', '?'],
          ['CONDUCTORES', 'Licencia profesional y capacitación', '✓', '?'],
          ['', 'Entrega ODI + EPP + Manejo defensivo', '✓', '✗'],
        ].map(([area, service, transccl, comp]) => `
          <tr>
            <td class="area-cell">${area}</td>
            <td>${service}</td>
            <td class="${transccl === '✓' ? 'check-yes' : 'check-no'}">${transccl}</td>
            <td class="${comp === '✓' ? 'check-yes' : comp === '✗' ? 'check-no' : 'check-unk'}">${comp}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="page-footer">
      <span>Transccl SpA · RUT 76.282.952-3 · Transporte privado de pasajeros</span>
      <span>Propuesta Comercial N° ${q.number}</span>
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 4: RESULTADOS Y GARANTÍA -->
<div class="page">
  <div class="section-page">
    <div class="section-header">
      <div class="section-number">3</div>
      <div class="section-title">Resultados comprobados — Garantía de Servicio</div>
      <img class="section-logo" src="${baseUrl}/logo-transccl.png" alt="Transccl" />
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-num">99,5%</div>
        <div class="kpi-label">Efectividad de servicios<br/>ejecutados puntual y efectivamente</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">+13</div>
        <div class="kpi-label">Años de experiencia<br/>en transporte privado de pasajeros</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">&lt;5%</div>
        <div class="kpi-label">Margen de error anual<br/>gracias a nuestro taller mecánico propio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">24/7</div>
        <div class="kpi-label">Disponibilidad de personal de tráfico,<br/>mecánicos y vehículos de apoyo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">&lt;40 min</div>
        <div class="kpi-label">Tiempo de activación<br/>de vehículo de contingencia</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">90%</div>
        <div class="kpi-label">Efectividad en contingencias<br/>gracias a nuestro equipo de taller</div>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${ACCENT};margin-bottom:12px;">Lo que dicen nuestros clientes</div>
      <div class="testimonial">
        <div class="testimonial-text">"Transccl nos ha brindado un apoyo sumamente importante este último año en el traslado de nuestros colaboradores. Una empresa cercana, atentos, flexibles y eficientes."</div>
        <div class="testimonial-author">Salcobrand — Transporte diario de colaboradores</div>
      </div>
      <div class="testimonial">
        <div class="testimonial-text">"El compromiso de ustedes como empresa y como personas es notable. Nos han ayudado en cada momento y ha sido muy eficaz el servicio que nos presta su empresa."</div>
        <div class="testimonial-author">Primus Capital S.A.</div>
      </div>
      <div class="testimonial">
        <div class="testimonial-text">"Transccl es una empresa que se adapta a las necesidades de sus clientes, un gran aliado en el cuidado de nuestros colaboradores."</div>
        <div class="testimonial-author">Mutual de Seguridad CCHC — 27 años en gestión de flota</div>
      </div>
    </div>

    <div style="background:#0d4f2b;border-radius:10px;padding:20px 24px;color:white;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#86efac;margin-bottom:8px;">Nuestra flota</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:11px;line-height:1.6;">
        <div><strong style="color:#86efac;">Buses 40–45 pax</strong><br/>Año 2008–2014. Butacas soft reclinables, multimedia, A/C, GPS</div>
        <div><strong style="color:#86efac;">Taxibuses 25–33 pax</strong><br/>Año 2013–2020. Butacas reclinables, multimedia, calefacción, maletero lateral</div>
        <div><strong style="color:#86efac;">Minibuses y Vans 7–19 pax</strong><br/>Año 2015–2024. Marcas reconocidas, A/C, filtro UV, SOAP y seguros adicionales</div>
      </div>
    </div>

    <div class="page-footer">
      <span>Transccl SpA · RUT 76.282.952-3 · Transporte privado de pasajeros</span>
      <span>Propuesta Comercial N° ${q.number}</span>
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 5: COTIZACIÓN -->
<div class="page">
  <div class="quot-page">
    <div class="quot-header">
      <div>
        <div class="quot-title-label">Cotización de Servicio Diario</div>
        <div class="quot-title-num">N° ${q.number}</div>
      </div>
      <div class="quot-date">
        Fecha emisión: ${fmtDate(q.issue_date)}<br/>
        ${q.expiry_date ? `Vigencia hasta: ${fmtDate(q.expiry_date)}<br/>` : ''}
        <strong>Exento de IVA</strong>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-title">Empresa cliente</div>
        <div class="info-box-name">${q.clients?.name ?? '—'}</div>
        ${q.clients?.rut ? `<div class="info-box-line">RUT: <strong>${q.clients.rut}</strong></div>` : ''}
        ${q.clients?.contacto ? `<div class="info-box-line">Contacto: ${q.clients.contacto}</div>` : ''}
        ${(q.clients as {telefono_fijo?: string})?.telefono_fijo ? `<div class="info-box-line">Tel.: ${(q.clients as {telefono_fijo?: string}).telefono_fijo}</div>` : ''}
        ${(q.clients as {telefono_celular?: string})?.telefono_celular ? `<div class="info-box-line">Cel.: ${(q.clients as {telefono_celular?: string}).telefono_celular}</div>` : ''}
        ${q.clients?.email ? `<div class="info-box-line">${q.clients.email}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-box-title">Ejecutivo comercial</div>
        <div class="info-box-name">${q.profiles?.name ?? '—'}</div>
        ${(q.profiles as {celular?: string})?.celular ? `<div class="info-box-line">📱 ${(q.profiles as {celular?: string}).celular}</div>` : ''}
        ${(q.profiles as {email?: string})?.email ? `<div class="info-box-line">✉ ${(q.profiles as {email?: string}).email}</div>` : ''}
        <div class="info-box-line" style="margin-top:8px;font-size:9px;color:#9ca3af;">Transportes Transccl SpA · RUT 76.282.952-3</div>
      </div>
    </div>

    ${q.desde || q.hasta ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;gap:24px;font-size:11px;">
      ${q.desde ? `<span><strong style="color:${ACCENT};">Desde:</strong> ${q.desde}</span>` : ''}
      ${q.hasta ? `<span><strong style="color:${ACCENT};">Hasta:</strong> ${q.hasta}</span>` : ''}
    </div>` : ''}

    <div class="routes-section">
      <div class="routes-section-title">Detalle de rutas y precios — Servicio de traslado diario ida y retorno</div>
      <div class="routes-table-wrap">
        <table class="routes-table">
          <thead>
            <tr>
              <th>RUTA / DESCRIPCIÓN DEL SERVICIO</th>
              <th style="width:100px;">VEHÍCULO</th>
              <th class="right" style="width:110px;">PRECIO / SERVICIO</th>
              <th class="right" style="width:80px;">FREC.</th>
              <th class="right" style="width:115px;">TOTAL MENSUAL</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0
              ? `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">Sin ítems registrados</td></tr>`
              : items.map((item: { codigo?: string; description: string; pasajeros?: number; quantity: number; unit_price: number; subtotal: number }) => {
                  const totalItem = item.quantity * item.unit_price
                  const listaItem = descuentoPct > 0 ? Math.round(item.unit_price / (1 - descuentoPct / 100)) : null
                  const vLabel = vehicleLabel(item.codigo)
                  return `
                <tr>
                  <td>
                    <div class="route-desc">${item.description}</div>
                    ${item.pasajeros ? `<div style="font-size:9.5px;color:#9ca3af;margin-top:3px;">${item.pasajeros} pasajeros</div>` : ''}
                  </td>
                  <td>
                    ${vLabel ? `<span class="vehicle-badge">${vLabel}</span>` : item.codigo ?? '—'}
                  </td>
                  <td class="right">
                    <div class="price-net">${formatCLP(item.unit_price)}</div>
                    ${listaItem ? `<div class="price-list">${formatCLP(listaItem)}</div>` : ''}
                  </td>
                  <td class="right" style="color:#374151;font-size:11px;">${item.quantity}</td>
                  <td class="right">
                    <div style="font-weight:700;font-size:12px;">${formatCLP(totalItem)}</div>
                    ${descuentoPct > 0 ? `<div style="text-align:right;margin-top:3px;"><span class="disc-badge">-${descuentoPct}%</span></div>` : ''}
                  </td>
                </tr>`
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="total-box">
      <div class="total-inner">
        ${descuentoPct > 0 ? `
        <div class="total-row">
          <span class="total-lbl">Precio lista (sin descuento)</span>
          <span class="total-val">${formatCLP(Math.round(totalMensualNeto / (1 - descuentoPct / 100)))}</span>
        </div>
        <div class="total-row">
          <span class="total-lbl">Descuento (${descuentoPct}%)</span>
          <span class="total-val" style="color:#d33a2c;">−${formatCLP(Math.round(totalMensualNeto / (1 - descuentoPct / 100)) - totalMensualNeto)}</span>
        </div>` : ''}
        <div class="total-row">
          <span class="total-lbl">Subtotal neto</span>
          <span class="total-val">${formatCLP(totalMensualNeto)}</span>
        </div>
        <div class="total-row" style="background:#f9fafb;">
          <span class="total-lbl" style="font-size:9.5px;color:#9ca3af;">IVA (Exento — Decreto 80)</span>
          <span class="total-val" style="font-size:10px;color:#9ca3af;">$0</span>
        </div>
        <div class="total-row">
          <span>TOTAL MENSUAL</span>
          <span>${formatCLP(totalMensualNeto)}</span>
        </div>
      </div>
    </div>

    ${q.observaciones ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:0.07em;margin-bottom:6px;">Observaciones</div>
      <div style="font-size:11.5px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${q.observaciones}</div>
    </div>` : ''}

    <div class="page-footer">
      <span>Transccl SpA · RUT 76.282.952-3 · Cotización N° ${q.number}</span>
      <span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:4px 12px;color:${ACCENT};font-weight:700;">
        ${q.expiry_date ? `Válida hasta ${fmtDate(q.expiry_date)}` : 'Vigencia 15 días corridos'}
      </span>
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PÁGINA 6: QUÉ INCLUYE -->
<div class="page">
  <div class="section-page">
    <div class="section-header">
      <div class="section-number">4</div>
      <div class="section-title">¿Qué incluye nuestro servicio?</div>
      <img class="section-logo" src="${baseUrl}/logo-transccl.png" alt="Transccl" />
    </div>

    <div class="includes-grid" style="margin-bottom:24px;">
      <div class="inc-card">
        <div class="inc-card-title">Comercial y operativo</div>
        <div class="inc-item">KAM (Key Account Manager)</div>
        <div class="inc-item">Protocolos de higiene vigentes</div>
        <div class="inc-item">Asesoramiento en ruta</div>
        <div class="inc-item">Departamento de operaciones</div>
        <div class="inc-item">Optimización de servicios</div>
        <div class="inc-item">Monitoreo GPS en tiempo real</div>
      </div>
      <div class="inc-card">
        <div class="inc-card-title">Vehículo</div>
        <div class="inc-item">TAG incluido</div>
        <div class="inc-item">Combustible incluido</div>
        <div class="inc-item">Peajes incluidos</div>
        <div class="inc-item">GPS y control de velocidad</div>
        <div class="inc-item">Aire acondicionado y calefacción</div>
        <div class="inc-item">SOAP y seguro de asiento</div>
        <div class="inc-item">Decreto N°80 (Santiago)</div>
      </div>
      <div class="inc-card">
        <div class="inc-card-title">Conductores</div>
        <div class="inc-item">Licencia profesional</div>
        <div class="inc-item">Entrega de ODI</div>
        <div class="inc-item">Entrega de EPP</div>
        <div class="inc-item">Manejo a la defensiva</div>
        <div class="inc-item">Más de 3 años de experiencia</div>
        <div class="inc-item">Proceso de selección riguroso</div>
      </div>
      <div class="inc-card">
        <div class="inc-card-title">Plan de contingencia</div>
        <div class="inc-item">Vehículo de reemplazo (mismas características)</div>
        <div class="inc-item">Vehículo de contingencia (activación &lt;40 min)</div>
        <div class="inc-item">Asistencia en ruta 24/7</div>
        <div class="inc-item">Conductor de reemplazo</div>
      </div>
      <div class="inc-card">
        <div class="inc-card-title">Taller mecánico propio</div>
        <div class="inc-item">Mantención preventiva</div>
        <div class="inc-item">Mantención correctiva</div>
        <div class="inc-item">Checklist diario, semanal y mensual</div>
        <div class="inc-item">Disponible 24/7</div>
        <div class="inc-item">Margen de error &lt;5% anual</div>
      </div>
      <div class="inc-card">
        <div class="inc-card-title">Control y medición KPI</div>
        <div class="inc-item">Monitoreo en tiempo real CMR</div>
        <div class="inc-item">Checklist preventivo de ruta diario</div>
        <div class="inc-item">Reportería mensual de efectividad</div>
        <div class="inc-item">Evaluación semestral y anual</div>
        <div class="inc-item">Control de usuarios en ruta</div>
      </div>
    </div>

    <div style="background:#0d4f2b;border-radius:10px;padding:20px 24px;color:white;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#86efac;margin-bottom:10px;">Proceso de compra y condiciones Transccl</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:10.5px;line-height:1.6;color:#dcfce7;">
        <div><strong style="color:#86efac;">Crédito vigente:</strong> Las órdenes de compra deben emitirse al mismo RUT y giro de esta cotización.</div>
        <div><strong style="color:#86efac;">Sin crédito:</strong> Reserva con 50% del total. El saldo se cancela antes del inicio del servicio.</div>
        <div><strong style="color:#86efac;">Exención de IVA:</strong> Transccl opera exenta de IVA. El valor cotizado es el total final a pagar.</div>
        <div><strong style="color:#86efac;">Vigencia:</strong> Esta cotización es válida por 15 días desde la fecha de emisión.</div>
        <div><strong style="color:#86efac;">Garantía:</strong> Incluye vehículos de contingencia y supervisión activa de tráfico en tiempo real.</div>
        <div><strong style="color:#86efac;">Decreto N°80:</strong> Transccl opera bajo la normativa del Ministerio de Transporte.</div>
      </div>
    </div>

    <div class="page-footer">
      <span>Transccl SpA · RUT 76.282.952-3 · ventas@transccl.cl · +56 2 2945 5713</span>
      <span>www.transccl.cl</span>
    </div>
  </div>
</div>

</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
