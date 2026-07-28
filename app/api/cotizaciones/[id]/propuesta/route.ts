import { fetchQuotation } from '@/lib/api'
import { formatCLP } from '@/lib/utils'

const ACCENT = '#1B8A4B'
const DARK   = '#0d4f2b'
const LIGHT  = '#86efac'

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
  return VEHICLE_LABEL[codigo.toUpperCase()] ?? codigo
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const base = new URL(req.url).origin
  const { id } = await params
  const urlToken = new URL(req.url).searchParams.get('token') ?? undefined

  const q = await fetchQuotation(id, urlToken)
  if (!q) return new Response('Not found', { status: 404 })

  const items = (q.quotation_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

  const descuentoPct = q.descuento_pct ?? 0
  const totalNeto = items.reduce((s: number, i: { quantity: number; unit_price: number }) =>
    s + i.quantity * i.unit_price, 0)

  // helpers
  const img = (name: string) => `${base}/propuesta/${name}`
  const logo = `${base}/logo-transccl.png`

  const sectionHeader = (num: number, title: string) => `
    <div class="sh">
      <div class="sh-num">${num}</div>
      <div class="sh-title">${title}</div>
      <img class="sh-logo" src="${logo}" alt="Transccl"/>
    </div>`

  const footer = `
    <div class="pf">
      <span>Transccl SpA · RUT 76.282.952-3 · ventas@transccl.cl · +56 2 2945 5713</span>
      <span>www.transccl.cl</span>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Propuesta Comercial ${q.number} — Transccl</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff}

.page{width:820px;margin:0 auto;page-break-after:always;position:relative;overflow:hidden}
.page:last-child{page-break-after:auto}

/* ── Botones ── */
.no-print{margin:0 auto 20px;max-width:820px;display:flex;gap:10px;padding:0 16px}
@media print{.no-print{display:none!important};body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}

/* ── Section layout ── */
.sp{padding:48px 56px;min-height:1060px;display:flex;flex-direction:column}
.sh{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${ACCENT};padding-bottom:12px;margin-bottom:28px}
.sh-num{width:40px;height:40px;border-radius:50%;background:${ACCENT};color:#fff;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sh-title{font-size:20px;font-weight:800;color:#111;margin-left:12px;flex:1}
.sh-logo{height:32px;width:auto;object-fit:contain}

/* ── Footer ── */
.pf{margin-top:auto;padding-top:14px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#9ca3af}

/* ─── PORTADA ─── */
.cover{min-height:1060px;display:flex;flex-direction:column;color:#fff;position:relative;overflow:hidden}
.cover-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.22) saturate(0.8)}
.cover-overlay{position:relative;z-index:1;display:flex;flex-direction:column;height:1060px}
.cover-stripe{height:5px;background:linear-gradient(90deg,${DARK} 0%,${LIGHT} 50%,${DARK} 100%)}
.cover-top{padding:44px 52px 0;display:flex;justify-content:space-between;align-items:flex-start}
.cover-logo{height:52px;width:auto;object-fit:contain}
.cover-contact{text-align:right;font-size:10px;color:${LIGHT};line-height:1.9}
.cover-center{flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 52px 40px}
.cover-eyebrow{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${LIGHT};margin-bottom:14px}
.cover-title{font-size:52px;font-weight:900;line-height:1.05;letter-spacing:-.01em;margin-bottom:6px}
.cover-num{font-size:22px;font-weight:400;color:${LIGHT};margin-bottom:28px}
.cover-divider{width:60px;height:4px;background:${LIGHT};border-radius:2px;margin-bottom:28px}
.cover-for{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LIGHT};margin-bottom:7px}
.cover-client{font-size:24px;font-weight:700;margin-bottom:4px}
.cover-sub{font-size:13px;color:#bbf7d0}
.cover-bottom{padding:24px 52px;border-top:1px solid rgba(134,239,172,.2);display:flex;justify-content:space-between;align-items:center}
.cover-bl{font-size:10.5px;color:${LIGHT};line-height:1.8}
.cover-br{font-size:10.5px;color:${LIGHT};text-align:right;line-height:1.8}

/* ─── Misión / Historia ─── */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.green-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:22px}
.green-card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${ACCENT};margin-bottom:12px}
.green-card p{font-size:11.5px;color:#1a1a1a;line-height:1.75;font-style:italic}
.photo-full{width:100%;border-radius:10px;object-fit:cover;margin:16px 0}
.photo-half{width:100%;border-radius:8px;object-fit:cover}

/* ─── SITPA ─── */
.sitpa-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:18px 0}
.sitpa-card{border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
.sitpa-letter{font-size:34px;font-weight:900;color:${ACCENT};margin-bottom:4px}
.sitpa-word{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#374151;margin-bottom:8px}
.sitpa-desc{font-size:9.5px;color:#6b7280;line-height:1.45}

/* ─── Tabla comparativa ─── */
.cmp-table{width:100%;border-collapse:collapse;font-size:10.5px}
.cmp-table th{background:${DARK};color:#fff;padding:9px 12px;text-align:center;font-weight:700}
.cmp-table th:nth-child(2){text-align:left}
.cmp-table td{padding:7px 12px;border-bottom:1px solid #f3f4f6}
.cmp-table tr:nth-child(even) td{background:#f9fafb}
.area-cell{font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.07em;color:#9ca3af}
.ck-y{color:${ACCENT};font-weight:700;text-align:center;font-size:13px}
.ck-n{color:#ef4444;text-align:center;font-size:13px}
.ck-u{color:#d97706;text-align:center;font-size:13px}

/* ─── Servicios ─── */
.svc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:20px 0}
.svc-card{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
.svc-photo{width:100%;height:160px;object-fit:cover}
.svc-body{padding:14px}
.svc-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${ACCENT};margin-bottom:8px}
.svc-text{font-size:10.5px;color:#374151;line-height:1.55}

/* ─── Flota ─── */
.flota-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
.flota-card{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.flota-photo{width:100%;height:170px;object-fit:cover}
.flota-body{padding:14px;flex:1}
.flota-title{font-size:11px;font-weight:700;color:${ACCENT};margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
.flota-spec{font-size:10px;color:#374151;line-height:1.65}

/* ─── Equipo ─── */
.equipo-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:16px 0}
.eq-card{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
.eq-photo{width:100%;height:180px;object-fit:cover}
.eq-body{padding:12px}
.eq-title{font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.eq-text{font-size:10px;color:#374151;line-height:1.6}
.eq-item{display:flex;gap:6px;align-items:flex-start;margin-bottom:5px;font-size:10px;color:#374151}
.eq-item::before{content:"✓";color:${ACCENT};font-weight:700;flex-shrink:0}

/* ─── KPI ─── */
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0}
.kpi-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;text-align:center}
.kpi-num{font-size:32px;font-weight:900;color:${ACCENT}}
.kpi-label{font-size:10px;color:#4b5563;margin-top:5px;line-height:1.4}
.kpi-icon-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.kpi-feature{display:flex;gap:12px;align-items:flex-start;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
.kpi-feature-icon{width:32px;height:32px;border-radius:6px;background:${ACCENT};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px}
.kpi-feature-title{font-size:10.5px;font-weight:700;color:#111;margin-bottom:4px}
.kpi-feature-text{font-size:10px;color:#6b7280;line-height:1.5}

/* ─── Seguridad ─── */
.seg-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
.seg-card{border:1px solid #e5e7eb;border-radius:10px;padding:16px}
.seg-title{font-size:10.5px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.seg-icon{font-size:16px}
.seg-item{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;font-size:10.5px;color:#374151}
.seg-item::before{content:"✓";color:${ACCENT};font-weight:700;flex-shrink:0}

/* ─── Efectividad ─── */
.efect-banner{background:${DARK};border-radius:12px;padding:24px 28px;color:#fff;margin:16px 0}
.efect-stat{font-size:48px;font-weight:900;color:${LIGHT};margin-bottom:4px}
.efect-sub{font-size:13px;color:#dcfce7;line-height:1.6}
.efect-detail{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:14px 0}
.efect-box{background:rgba(255,255,255,.07);border-radius:8px;padding:14px;text-align:center}
.efect-box-num{font-size:24px;font-weight:800;color:${LIGHT}}
.efect-box-label{font-size:9.5px;color:#bbf7d0;margin-top:4px;line-height:1.4}

/* ─── Testimonios ─── */
.test-card{display:flex;gap:16px;background:#f9fafb;border-radius:10px;border-left:4px solid ${ACCENT};padding:16px;margin-bottom:14px}
.test-photo{width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0}
.test-photo-placeholder{width:72px;height:72px;border-radius:50%;background:${ACCENT};display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;flex-shrink:0}
.test-body{}
.test-text{font-size:11.5px;color:#374151;line-height:1.65;font-style:italic;margin-bottom:8px}
.test-author{font-size:10px;font-weight:700;color:${ACCENT}}
.test-role{font-size:9.5px;color:#6b7280}

/* ─── Clientes ─── */
.clientes-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.cliente-chip{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;font-size:10px;font-weight:700;color:#374151}

/* ─── Cotización ─── */
.quot-header{background:${DARK};color:#fff;padding:26px 36px;margin:-48px -56px 28px;display:flex;justify-content:space-between;align-items:center}
.qt-label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#bbf7d0;margin-bottom:5px}
.qt-num{font-size:28px;font-weight:900}
.qt-right{text-align:right;font-size:10.5px;color:#bbf7d0;line-height:1.9}

.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.info-box{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
.info-box-title{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px}
.info-box-name{font-size:14px;font-weight:700;color:#111;margin-bottom:4px}
.info-box-line{font-size:11px;color:#4b5563;line-height:1.7}

.rt-wrap{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px}
.rt{width:100%;border-collapse:collapse}
.rt thead{background:#111}
.rt th{padding:9px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.05em}
.rt th.r,.rt td.r{text-align:right}
.rt td{padding:9px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;vertical-align:top}
.rt tbody tr:last-child td{border-bottom:none}
.rt tbody tr:nth-child(even){background:#f9fafb}

.vbadge{display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:${ACCENT};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap}
.price-net{font-weight:700;color:#111;font-size:11.5px}
.price-list{font-size:9.5px;color:#9ca3af;text-decoration:line-through}
.disc-badge{display:inline-block;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:8.5px;font-weight:700;padding:1px 5px;border-radius:8px}

.total-box{display:flex;justify-content:flex-end;margin-bottom:16px}
.total-inner{width:280px;border:2px solid ${ACCENT};border-radius:10px;overflow:hidden}
.total-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #f3f4f6}
.total-row:last-child{background:${DARK};border-bottom:none}
.total-row:last-child span{color:#fff;font-size:14px;font-weight:800}
.total-lbl{color:#6b7280}
.total-val{font-weight:600;color:#111}

/* ─── Qué incluye ─── */
.inc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:14px 0}
.inc-card{border:1px solid #e5e7eb;border-radius:8px;padding:14px}
.inc-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${ACCENT};margin-bottom:8px;border-bottom:2px solid ${ACCENT};padding-bottom:6px}
.inc-item{font-size:10.5px;color:#374151;display:flex;gap:6px;align-items:flex-start;margin-bottom:5px}
.inc-item::before{content:"✓";color:${ACCENT};font-weight:700;flex-shrink:0}

.dark-box{background:${DARK};border-radius:10px;padding:18px 22px;color:#fff}
.dark-box-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${LIGHT};margin-bottom:10px}
.dark-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:10.5px;line-height:1.6;color:#dcfce7}
.dark-grid strong{color:${LIGHT}}
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()"
    style="background:${ACCENT};color:#fff;border:none;padding:10px 22px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer">
    🖨 Imprimir / Guardar PDF
  </button>
  <button onclick="window.close()"
    style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:10px 22px;border-radius:7px;font-size:13px;cursor:pointer">
    Cerrar
  </button>
</div>

<!-- ══════════════════════════════════════ PÁGINA 1: PORTADA -->
<div class="page">
  <div class="cover">
    <img class="cover-bg" src="${img('cover-bg.jpg')}" alt=""/>
    <div class="cover-overlay">
      <div class="cover-stripe"></div>
      <div class="cover-top">
        <img class="cover-logo" src="${logo}" alt="Transccl"/>
        <div class="cover-contact">
          www.transccl.cl<br/>
          +56 2 2945 5713<br/>
          ventas@transccl.cl
        </div>
      </div>
      <div class="cover-center">
        <div class="cover-eyebrow">Documento Comercial Confidencial</div>
        <div class="cover-title">PROPUESTA<br/>COMERCIAL</div>
        <div class="cover-num">N° ${q.number}</div>
        <div class="cover-divider"></div>
        <div class="cover-for">Preparado para</div>
        <div class="cover-client">${q.clients?.name ?? '—'}</div>
        ${q.clients?.rut ? `<div class="cover-sub">RUT: ${q.clients.rut}</div>` : ''}
        ${q.clients?.contacto ? `<div class="cover-sub" style="margin-top:4px;">Att.: ${q.clients.contacto}</div>` : ''}
      </div>
      <div class="cover-bottom">
        <div class="cover-bl">
          <strong>Transportes Transccl SpA</strong><br/>
          RUT: 76.282.952-3<br/>
          Traslado Diario de Pasajeros
        </div>
        <div class="cover-br">
          Fecha: ${fmtDate(q.issue_date)}<br/>
          ${q.expiry_date ? `Válido hasta: ${fmtDate(q.expiry_date)}<br/>` : ''}
          ${q.profiles?.name ? `Ejecutivo: ${q.profiles.name}` : ''}
        </div>
      </div>
      <div class="cover-stripe"></div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 2: MISIÓN Y VISIÓN -->
<div class="page">
  <div class="sp">
    ${sectionHeader(1, 'Nuestra Misión y Visión')}

    <div class="two-col" style="margin-bottom:18px;">
      <div class="green-card">
        <div class="green-card-label">Misión</div>
        <p>"Estar a la vanguardia en Chile para seguir avanzando en ser líderes en el mercado del transporte privado de pasajeros, donde nuestra sigla de medición de KPI es SITPA — Servicio Integral de Transporte Profesional de Pasajeros."</p>
      </div>
      <div class="green-card">
        <div class="green-card-label">Visión</div>
        <p>"Ser una empresa que lidere en todos los ámbitos el transporte privado de pasajeros, ocupando el conocimiento de nuestro equipo humano y profesional, apoyados del uso de las tecnologías para que el cliente y nuestro equipo siempre vivan una experiencia de viaje cómoda y segura."</p>
      </div>
    </div>

    <img class="photo-full" style="height:200px;object-fit:cover" src="${img('mision-foto.jpg')}" alt="Transccl equipo"/>

    <div style="text-align:center;padding:18px;border:1px solid #e5e7eb;border-radius:10px;margin:14px 0;">
      <div style="font-size:22px;font-weight:900;color:${ACCENT};letter-spacing:.08em;margin-bottom:6px;">SITPA</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:10px;">Servicio Integral de Transporte Profesional de Pasajeros</div>
      <p style="font-size:11.5px;color:#374151;line-height:1.7;max-width:560px;margin:0 auto;font-style:italic;">"Lo importante de nuestro viaje son nuestro equipo humano y nuestros clientes. Para que el cliente y nuestro equipo siempre vivan una experiencia de viajar cómodos y seguros."</p>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 3: NUESTRA HISTORIA -->
<div class="page">
  <div class="sp">
    ${sectionHeader(2, 'Nuestra Historia')}

    <div class="two-col" style="margin-bottom:18px;">
      <div>
        <p style="font-size:11.5px;color:#374151;line-height:1.8;margin-bottom:14px;">
          La historia de <strong>Transccl</strong> comienza en el año 2011 cuando su fundador
          <strong>Claudio Chuhaicura</strong> decide retomar una historia familiar en la operación del
          transporte privado de pasajeros, atreviéndose a iniciar con un vehículo particular
          manejado por él mismo.
        </p>
        <p style="font-size:11.5px;color:#374151;line-height:1.8;margin-bottom:14px;">
          La necesidad de generar un cambio en el rubro le permitió crecer profesionalmente y
          formar una gran familia. Solo con una idea innovadora y un sueño se creó la sigla
          <strong style="color:${ACCENT};">SITPA</strong> para entregar a usuarios e instituciones
          un servicio amigable y eficiente.
        </p>
        <div class="green-card" style="margin-top:10px;">
          <div class="green-card-label">Hoy, más de 13 años después</div>
          <p style="font-style:normal;">"La empresa sigue formando un equipo comprometido y visionario que le permite entregar una experiencia de viaje cómoda y segura a todos nuestros clientes."</p>
        </div>
      </div>
      <div>
        <img class="photo-half" style="height:340px;object-fit:cover" src="${img('historia-foto.jpg')}" alt="Historia Transccl"/>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px;">
      ${[
        ['2011', 'Inicio de operaciones con un vehículo propio'],
        ['2013', 'Creación oficial de Transportes Transccl SpA'],
        ['2017', 'Incorporación de taller mecánico propio'],
        ['+13', 'Años de experiencia en el mercado'],
      ].map(([year, text]) => `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:${ACCENT};margin-bottom:6px;">${year}</div>
          <div style="font-size:10px;color:#6b7280;line-height:1.45;">${text}</div>
        </div>
      `).join('')}
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 4: SITPA -->
<div class="page">
  <div class="sp">
    ${sectionHeader(3, 'SITPA — Nuestra filosofía de trabajo')}

    <div style="background:${DARK};border-radius:12px;padding:22px 28px;color:#fff;margin-bottom:24px;text-align:center;">
      <div style="font-size:32px;font-weight:900;letter-spacing:.12em;color:${LIGHT};margin-bottom:8px;">SITPA</div>
      <div style="font-size:11px;color:#bbf7d0;line-height:1.7;">
        "Nuestra sigla de crecimiento y evaluación de nuestros procesos es la calidad que podemos entregar en nuestros servicios"
      </div>
    </div>

    <div class="sitpa-grid">
      ${[
        ['S', 'Servicio',
         'El valor de nuestros servicios se basa en entregar a nuestros colaboradores instalaciones y herramientas adecuadas para el desempeño de sus labores, para que se sientan felices y orgullosos de trabajar en nuestra empresa.'],
        ['I', 'Integral',
         'Incorporamos todos los elementos que componen el transporte de pasajeros: taller mecánico, combustible, tecnología, personal humano. Integrar buenos colaboradores y proveedores nos ayuda a tener un mejor control.'],
        ['T', 'Transporte',
         'Más de 13 años de experiencia con todas las marcas del mercado, filtrando lo mejor del rubro para garantizar confort, seguridad y puntualidad en cada servicio.'],
        ['P', 'Profesional',
         'Todo nuestro personal pasa por un proceso de selección riguroso que incluye exámenes físicos, capacitación en manejo defensivo, entrega de ODI y EPP según normativa vigente.'],
        ['A', 'Pasajeros',
         'Todo nuestro trabajo garantiza un servicio de primera necesidad con los más altos estándares de calidad para que cada pasajero llegue seguro, puntual y confortable.'],
      ].map(([letter, word, desc]) => `
        <div class="sitpa-card">
          <div class="sitpa-letter">${letter}</div>
          <div class="sitpa-word">${word}</div>
          <div class="sitpa-desc">${desc}</div>
        </div>
      `).join('')}
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 22px;margin-top:10px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${ACCENT};margin-bottom:10px;">Valores que nos definen</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${[
          ['Compromiso', 'Con nuestros clientes, colaboradores y la sociedad'],
          ['Puntualidad', 'En cada servicio, cada día, sin excepciones'],
          ['Transparencia', 'En precios, condiciones y comunicación permanente'],
          ['Innovación', 'Tecnología GPS, apps y sistemas de control modernos'],
          ['Seguridad', 'SOAP, seguros adicionales y protocolos certificados'],
          ['Calidad', 'Checklist diario, mantención preventiva y KPIs'],
        ].map(([title, desc]) => `
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="width:28px;height:28px;border-radius:6px;background:${ACCENT};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;">✓</div>
            <div>
              <div style="font-size:10.5px;font-weight:700;color:#111;margin-bottom:3px;">${title}</div>
              <div style="font-size:9.5px;color:#6b7280;line-height:1.4;">${desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 5: ¿POR QUÉ ELEGIRNOS? -->
<div class="page">
  <div class="sp">
    ${sectionHeader(4, '¿Por qué elegirnos? — Cuadro comparativo')}

    <table class="cmp-table">
      <thead>
        <tr>
          <th style="text-align:left;width:110px;">ÁREA</th>
          <th style="text-align:left;">SERVICIO</th>
          <th style="width:110px;">TRANSCCL</th>
          <th style="width:110px;">COMPETENCIA</th>
        </tr>
      </thead>
      <tbody>
        ${[
          ['COMERCIAL', 'Precio del servicio competitivo', '✓', '✓'],
          ['', 'Contrato Flex', '✓', '✗'],
          ['', 'KAM (Key Account Manager)', '✓', '?'],
          ['', 'Mesa de ayuda al usuario', '✓', '✗'],
          ['', 'Protocolos de higiene y salud', '✓', '?'],
          ['', 'Asesoramiento en ruta', '✓', '?'],
          ['', 'KPI´s de medición y reportería', '✓', '✗'],
          ['', 'Departamento de Operaciones', '✓', '?'],
          ['', 'Optimización de servicios', '✓', '?'],
          ['', 'Evaluación anual y semestral', '✓', '✗'],
          ['', 'Control de usuarios en ruta', '✓', '✗'],
          ['VEHÍCULO', 'TAG, Combustible y Peajes incluidos', '✓', '?'],
          ['', 'GPS y control de velocidad', '✓', '?'],
          ['', 'Año según requerimiento del cliente', '✓', '?'],
          ['', 'Aire acondicionado y calefacción', '✓', '?'],
          ['', 'SOAP + Seguros adicionales', '✓', '?'],
          ['', 'Decreto N°80 (Santiago)', '✓', '?'],
          ['PLAN CONTINGENCIA', 'Vehículo de reemplazo', '✓', '?'],
          ['', 'Asistencia en ruta 24/7', '✓', '?'],
          ['', 'Conductor de reemplazo', '✓', '?'],
          ['TALLER', 'Mantención preventiva y correctiva', '✓', '?'],
          ['', 'Mecánicos disponibles 24/7', '✓', '?'],
          ['', 'Checklist diario, semanal y mensual', '✓', '?'],
          ['CONDUCTORES', 'Licencia profesional y exámenes', '✓', '?'],
          ['', 'Entrega de ODI + EPP + Manejo defensivo', '✓', '✗'],
        ].map(([area, service, t, c]) => `
          <tr>
            <td class="area-cell">${area}</td>
            <td>${service}</td>
            <td class="${t==='✓'?'ck-y':t==='✗'?'ck-n':'ck-u'}">${t}</td>
            <td class="${c==='✓'?'ck-y':c==='✗'?'ck-n':'ck-u'}">${c}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 6: NUESTROS SERVICIOS -->
<div class="page">
  <div class="sp">
    ${sectionHeader(5, 'Nuestros Servicios')}

    <p style="font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:16px;">
      Garantizamos un viaje cómodo y seguro para tu personal con vehículos que cuentan con los mejores
      estándares de calidad, brindando a sus colaboradores un viaje confortable y una atención exclusiva
      y personalizada con ejecutivos altamente capacitados.
    </p>

    <div class="svc-grid">
      <div class="svc-card">
        <img class="svc-photo" src="${img('servicio-diario.jpg')}" alt="Traslado diario"/>
        <div class="svc-body">
          <div class="svc-title">🚌 Traslado Diario</div>
          <div class="svc-text">Traslado de colaboradores desde y hacia sus lugares de trabajo, con rutas optimizadas, puntualidad garantizada y seguimiento GPS en tiempo real.</div>
        </div>
      </div>
      <div class="svc-card">
        <img class="svc-photo" src="${img('servicio-eventos.jpg')}" alt="Eventos y turismo"/>
        <div class="svc-body">
          <div class="svc-title">🎉 Eventos y Turismo</div>
          <div class="svc-text">Te acompañamos a todos los lugares: paseos dentro y fuera de Santiago, traslado para eventos masivos, salidas de empresas y transfer al aeropuerto.</div>
        </div>
      </div>
      <div class="svc-card">
        <img class="svc-photo" src="${img('servicio-colegios.jpg')}" alt="Transporte escolar"/>
        <div class="svc-body">
          <div class="svc-title">🏫 Servicio Escolar</div>
          <div class="svc-text">Es nuestra responsabilidad social como empresa aportar con la educación de nuestro país, brindando a los niños un servicio integral de calidad.</div>
        </div>
      </div>
    </div>

    <img class="photo-full" style="height:220px;object-fit:cover;margin-top:4px;" src="${img('servicios-main.jpg')}" alt="Flota Transccl"/>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;">
      ${[
        ['📍', 'Cobertura nacional', 'Santiago y regiones'],
        ['⏱', 'Puntualidad garantizada', '99,5% de efectividad'],
        ['📞', 'Atención 24/7', 'Soporte permanente'],
      ].map(([icon, title, sub]) => `
        <div style="display:flex;gap:10px;align-items:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
          <div style="font-size:20px;">${icon}</div>
          <div>
            <div style="font-size:10.5px;font-weight:700;color:#111;">${title}</div>
            <div style="font-size:9.5px;color:#6b7280;">${sub}</div>
          </div>
        </div>
      `).join('')}
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 7: NUESTRA FLOTA -->
<div class="page">
  <div class="sp">
    ${sectionHeader(6, 'Nuestra Flota')}

    <img style="width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:16px;" src="${img('flota-main.jpg')}" alt="Flota Transccl"/>

    <div class="flota-grid">
      <div class="flota-card">
        <img class="flota-photo" src="${img('flota-bus45.jpg')}" alt="Bus 40-45 pax"/>
        <div class="flota-body">
          <div class="flota-title">Buses 40–45 Pasajeros</div>
          <div class="flota-spec">
            <strong>Año:</strong> 2008 al 2014<br/>
            <strong>Capacidad:</strong> 40 a 45 pasajeros<br/>
            Butacas clásicas o soft reclinables<br/>
            Sistema multimedia (radio, TV, DVD)<br/>
            Cámaras de seguridad y micrófonos<br/>
            Luces individuales · Calefacción · A/C<br/>
            Paqueteras interiores · Maletero lateral<br/>
            SOAP + Seguros adicionales
          </div>
        </div>
      </div>
      <div class="flota-card">
        <img class="flota-photo" src="${img('flota-taxibus.jpg')}" alt="Bus 25-33 pax"/>
        <div class="flota-body">
          <div class="flota-title">Buses 25–33 Pasajeros</div>
          <div class="flota-spec">
            <strong>Año:</strong> 2013 al 2020<br/>
            <strong>Capacidad:</strong> 25 a 33 pasajeros<br/>
            Butacas reclinables<br/>
            Sistema multimedia (radio, DVD)<br/>
            Sistemas de seguridad integrados<br/>
            Luces individuales · Calefacción<br/>
            Cortinas · Maletero lateral<br/>
            SOAP + Seguros adicionales
          </div>
        </div>
      </div>
      <div class="flota-card">
        <img class="flota-photo" src="${img('flota-minibus.jpg')}" alt="Minibús y Van"/>
        <div class="flota-body">
          <div class="flota-title">Minibús 15–19 Pax</div>
          <div class="flota-spec">
            <strong>Año:</strong> 2015 al 2024<br/>
            <strong>Capacidad:</strong> 15 a 19 pasajeros<br/>
            Butacas semi reclinables<br/>
            Radio · CD · Calefacción y A/C<br/>
            Sistemas de seguridad<br/>
            Ventanas corredizas con filtro UV<br/>
            Marcas reconocidas del mercado<br/>
            SOAP + Seguros adicionales
          </div>
        </div>
      </div>
      <div class="flota-card" style="grid-column:span 1">
        <div class="flota-body" style="border:1px solid #e5e7eb;border-radius:10px;height:100%;padding:14px;">
          <div class="flota-title">Vans 7–10 Pasajeros</div>
          <div class="flota-spec">
            <strong>Año:</strong> 2018 al 2024<br/>
            <strong>Capacidad:</strong> 7 a 10 pasajeros<br/>
            Marcas reconocidas (Toyota, Hyundai)<br/>
            A/C · Calefacción<br/>
            SOAP + Seguros adicionales<br/>
            GPS y control de velocidad<br/>
            Ideales para ejecutivos y grupos pequeños
          </div>
        </div>
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 8: NUESTRO EQUIPO -->
<div class="page">
  <div class="sp">
    ${sectionHeader(7, 'Nuestro Equipo Humano')}

    <p style="font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:18px;">
      Nuestro equipo humano está altamente capacitado para atender a cada uno de nuestros clientes en todas
      nuestras áreas. Seleccionamos a las mejores personas y les entregamos las herramientas para brillar.
    </p>

    <div class="equipo-grid">
      <div class="eq-card">
        <img class="eq-photo" src="${img('equipo-conductor.jpg')}" alt="Conductores" style="object-position:top"/>
        <div class="eq-body">
          <div class="eq-title">Personal de Conducción</div>
          <div class="eq-item">Licencia profesional clase D o E</div>
          <div class="eq-item">Exámenes físicos y psicológicos</div>
          <div class="eq-item">Capacitación en manejo defensivo</div>
          <div class="eq-item">Entrega de ODI y EPP</div>
          <div class="eq-item">+3 años de experiencia mínima</div>
        </div>
      </div>
      <div class="eq-card">
        <img class="eq-photo" src="${img('equipo-taller.jpg')}" alt="Taller"/>
        <div class="eq-body">
          <div class="eq-title">Taller Mecánico</div>
          <div class="eq-item">Mecánicos disponibles 24/7</div>
          <div class="eq-item">Mantenimiento preventivo y correctivo</div>
          <div class="eq-item">Checklist diario en cada vehículo</div>
          <div class="eq-item">Electricistas y especialistas</div>
          <div class="eq-item">Área de higiene y limpieza</div>
        </div>
      </div>
      <div class="eq-card">
        <img class="eq-photo" src="${img('equipo-admin.jpg')}" alt="Administrativo" style="object-position:top"/>
        <div class="eq-body">
          <div class="eq-title">Equipo Administrativo</div>
          <div class="eq-item">Departamento Legal</div>
          <div class="eq-item">Departamento Financiero</div>
          <div class="eq-item">Departamento de Operaciones</div>
          <div class="eq-item">Área Comercial con KAM</div>
          <div class="eq-item">Prevención de Riesgos</div>
        </div>
      </div>
    </div>

    <div class="dark-box" style="margin-top:14px;">
      <div class="dark-box-title">Proceso de selección de conductores</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:10.5px;color:#dcfce7;line-height:1.6;">
        <div><strong style="color:${LIGHT};">1. Postulación</strong><br/>Revisión de antecedentes y licencia profesional vigente</div>
        <div><strong style="color:${LIGHT};">2. Exámenes</strong><br/>Físicos, psicológicos y conducción con la Mutualidad de Salud</div>
        <div><strong style="color:${LIGHT};">3. Capacitación</strong><br/>Manejo defensivo, ODI, EPP y protocolos de servicio Transccl</div>
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 9: CONTROL Y KPI -->
<div class="page">
  <div class="sp">
    ${sectionHeader(8, 'Control y Medición de KPI')}

    <p style="font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:18px;">
      Todos nuestros clientes tienen acceso a nuestros sistemas de medición, con monitoreo en tiempo real
      y reportería periódica para garantizar transparencia y mejora continua en cada servicio.
    </p>

    <div class="kpi-icon-grid">
      ${[
        ['🛰', 'GPS en Tiempo Real', 'Monitoreo de cada vehículo con trazabilidad de ruta, control de velocidad y ubicación de usuarios en tiempo real'],
        ['📋', 'Checklist Diario', 'En cada servicio se realizan checklist preventivos de ruta. El supervisor de tráfico valida el estado del vehículo antes de cada salida'],
        ['📊', 'Reportería Mensual', 'Informe detallado de efectividad, puntualidad, novedades y KPIs acordados con el cliente. Evaluación semestral y anual'],
        ['📱', 'App de Usuarios', 'En implementación: plataforma para que los usuarios registren su ingreso al vehículo mediante su teléfono móvil'],
        ['🔧', 'CMR Operacional', 'Sistema CRM de monitoreo operacional con registro de cada servicio, incidente y acción correctiva tomada'],
        ['⚡', 'Respuesta Inmediata', 'Central de comunicaciones activa las 24 horas. Tiempo de respuesta ante contingencias: máximo 40 minutos'],
      ].map(([icon, title, text]) => `
        <div class="kpi-feature">
          <div class="kpi-feature-icon">${icon}</div>
          <div>
            <div class="kpi-feature-title">${title}</div>
            <div class="kpi-feature-text">${text}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 22px;margin-top:14px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${ACCENT};margin-bottom:12px;">Indicadores que medimos por usted</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${[
          ['% Puntualidad', 'Servicios ejecutados dentro del horario acordado'],
          ['% Efectividad', 'Servicios realizados vs. programados'],
          ['% Incidencias', 'Fallas mecánicas, conductores, rutas'],
          ['Tiempo respuesta', 'Activación de contingencia ante falla'],
          ['Satisfacción usuario', 'Encuestas periódicas a colaboradores'],
          ['Control velocidad', 'Alertas por exceso de velocidad en ruta'],
        ].map(([title, desc]) => `
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <div style="width:6px;height:6px;border-radius:50%;background:${ACCENT};margin-top:5px;flex-shrink:0;"></div>
            <div>
              <div style="font-size:10.5px;font-weight:700;color:#111;">${title}</div>
              <div style="font-size:9.5px;color:#6b7280;line-height:1.4;">${desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 10: PROTOCOLOS DE SEGURIDAD -->
<div class="page">
  <div class="sp">
    ${sectionHeader(9, 'Protocolos de Seguridad y Contingencia')}

    <p style="font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:18px;">
      Todos nuestros servicios y vehículos cuentan con la <strong>Garantía SITPA</strong> — un conjunto
      de protocolos que nos permite responder ante cualquier eventualidad de forma rápida y eficiente,
      con un tiempo de respuesta máximo de <strong>40 minutos</strong>.
    </p>

    <div class="seg-grid">
      <div class="seg-card">
        <div class="seg-title"><span class="seg-icon">🚗</span> Plan de Contingencia Vehicular</div>
        <div class="seg-item">Vehículo de reemplazo con iguales o mejores características</div>
        <div class="seg-item">Activación en máximo 40 minutos</div>
        <div class="seg-item">Flota de apoyo disponible 24 horas</div>
        <div class="seg-item">Coordinación inmediata con el cliente</div>
        <div class="seg-item">Conductor de apoyo en paralelo</div>
      </div>
      <div class="seg-card">
        <div class="seg-title"><span class="seg-icon">👨‍🔧</span> Taller Mecánico Propio 24/7</div>
        <div class="seg-item">Mecánicos disponibles las 24 horas</div>
        <div class="seg-item">Asistencia en ruta para eventualidades leves</div>
        <div class="seg-item">Mantención preventiva y correctiva</div>
        <div class="seg-item">Checklist diario, semanal y mensual</div>
        <div class="seg-item">Margen de error &lt;5% anual</div>
      </div>
      <div class="seg-card">
        <div class="seg-title"><span class="seg-icon">👷</span> Conductores de Reemplazo</div>
        <div class="seg-item">Personal de reemplazo por vacaciones</div>
        <div class="seg-item">Cobertura por licencias médicas</div>
        <div class="seg-item">Mismos estándares de selección y capacitación</div>
        <div class="seg-item">Base de datos de conductores certificados</div>
      </div>
      <div class="seg-card">
        <div class="seg-title"><span class="seg-icon">📡</span> Central de Tráfico Activa</div>
        <div class="seg-item">Personal de tráfico disponible 24/7</div>
        <div class="seg-item">Monitoreo GPS de toda la flota</div>
        <div class="seg-item">Planta telefónica de apoyo permanente</div>
        <div class="seg-item">Administrador de contrato en terreno</div>
        <div class="seg-item">Comunicación directa ejecutivo–cliente</div>
      </div>
    </div>

    <div class="dark-box" style="margin-top:14px;">
      <div class="dark-box-title">Normativa y certificaciones</div>
      <div class="dark-grid">
        <div><strong>Decreto N°80 MTT</strong><br/>Transccl opera bajo la normativa del Ministerio de Transportes (Santiago)</div>
        <div><strong>SOAP obligatorio</strong><br/>Todos nuestros vehículos cuentan con SOAP vigente y seguros adicionales de asiento</div>
        <div><strong>Revisión Técnica</strong><br/>100% de nuestra flota al día en su revisión técnica obligatoria</div>
        <div><strong>Prevención de Riesgos</strong><br/>Área dedicada de prevención con protocolos actualizados</div>
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 11: EFECTIVIDAD Y KPIs -->
<div class="page">
  <div class="sp">
    ${sectionHeader(10, 'Efectividad comprobada con nuestros clientes')}

    <div class="efect-banner">
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:24px;align-items:center;">
        <div style="text-align:center;">
          <div class="efect-stat">99,5%</div>
          <div class="efect-sub">Efectividad en servicios<br/>ejecutados durante el año</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${LIGHT};margin-bottom:10px;">KPI 2023 — Salcobrand (1er semestre)</div>
          <div class="efect-detail">
            <div class="efect-box">
              <div class="efect-box-num">3.648</div>
              <div class="efect-box-label">Servicios programados en el semestre</div>
            </div>
            <div class="efect-box">
              <div class="efect-box-num">3.632</div>
              <div class="efect-box-label">Servicios ejecutados<br/>correctamente</div>
            </div>
            <div class="efect-box">
              <div class="efect-box-num">16</div>
              <div class="efect-box-label">Incidencias gestionadas<br/>con protocolo</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="kpi-grid" style="margin:16px 0;">
      ${[
        ['+13', 'Años de experiencia en el mercado del transporte privado'],
        ['24/7', 'Disponibilidad de personal de tráfico, taller y conductores de apoyo'],
        ['&lt;40 min', 'Tiempo de activación de vehículo de contingencia'],
        ['&lt;5%', 'Margen de error anual según informe de taller mecánico (2020)'],
        ['90%', 'Efectividad en contingencias gracias al equipo de taller propio'],
        ['100%', 'De nuestra flota con GPS, SOAP y revisión técnica al día'],
      ].map(([num, label]) => `
        <div class="kpi-card">
          <div class="kpi-num">${num}</div>
          <div class="kpi-label">${label}</div>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${ACCENT};margin-bottom:10px;">Algunos de nuestros clientes</div>
      <div class="clientes-grid">
        ${['Salcobrand','Mutual de Seguridad CCHC','Primus Capital','Codelpa','Universidad de Chile','Banco Estado','Entel','Clínica Las Condes'].map(c =>
          `<div class="cliente-chip">${c}</div>`).join('')}
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 12: TESTIMONIOS -->
<div class="page">
  <div class="sp">
    ${sectionHeader(11, 'Experiencia de nuestros clientes')}

    <p style="font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:20px;">
      La mejor prueba de nuestro servicio es lo que dicen quienes ya confían en nosotros.
      Estas son las palabras de quienes han experimentado el servicio Transccl.
    </p>

    <div class="test-card">
      <img class="test-photo" src="${img('testimonio-1.jpg')}" alt="Gabriel Segura"/>
      <div class="test-body">
        <div class="test-text">"Transccl es una empresa que se adapta a las necesidades de sus clientes, un gran aliado en el cuidado de nuestros colaboradores. Durante 3 años el equipo de Transccl nos ha apoyado en el traslado de nuestros colaboradores desempeñándose de una manera muy eficaz."</div>
        <div class="test-author">Gabriel Segura</div>
        <div class="test-role">Supervisor Administrativo — Mutual de Seguridad CCHC</div>
      </div>
    </div>

    <div class="test-card">
      <img class="test-photo" src="${img('testimonio-2.jpg')}" alt="Daniel Fabio"/>
      <div class="test-body">
        <div class="test-text">"Una empresa de calidad, seriedad y compromiso del servicio otorgado. Llevo 27 años en Mutual de Seguridad CCHC, 15 de estos como Encargado de Flota a nivel Nacional, y el servicio de Transccl cumple con todos los estándares que necesitamos."</div>
        <div class="test-author">Daniel Fabio L.</div>
        <div class="test-role">Encargado de Flota Nacional — Mutual de Seguridad CCHC</div>
      </div>
    </div>

    <div class="test-card">
      <div class="test-photo-placeholder">S</div>
      <div class="test-body">
        <div class="test-text">"Transccl nos ha brindado un apoyo sumamente importante este último año en el traslado de nuestros colaboradores. Una empresa cercana, atentos, flexibles y eficientes. El compromiso de ustedes como empresa y como personas es notable."</div>
        <div class="test-author">Equipo de Recursos Humanos</div>
        <div class="test-role">Salcobrand — Traslado diario de colaboradores</div>
      </div>
    </div>

    <div class="test-card">
      <div class="test-photo-placeholder">P</div>
      <div class="test-body">
        <div class="test-text">"El compromiso de ustedes como empresa y como personas es notable. Nos han ayudado en cada momento y ha sido muy eficaz el servicio que nos presta su empresa. Felices con la calidad del servicio y la rapidez de respuesta ante contingencias."</div>
        <div class="test-author">Equipo de Gestión</div>
        <div class="test-role">Primus Capital S.A.</div>
      </div>
    </div>

    ${footer}
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 13: COTIZACIÓN -->
<div class="page">
  <div class="sp">
    <div class="quot-header">
      <div>
        <div class="qt-label">Cotización — Servicio de Traslado Diario</div>
        <div class="qt-num">N° ${q.number}</div>
      </div>
      <div class="qt-right">
        Fecha: ${fmtDate(q.issue_date)}<br/>
        ${q.expiry_date ? `Vigencia: ${fmtDate(q.expiry_date)}<br/>` : ''}
        <strong>Exento de IVA — Decreto 80</strong>
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

    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${ACCENT};border-left:4px solid ${ACCENT};padding-left:10px;margin-bottom:8px;">
      Detalle de rutas y precios — Servicio de traslado diario ida y retorno
    </div>
    <div class="rt-wrap">
      <table class="rt">
        <thead>
          <tr>
            <th>RUTA / DESCRIPCIÓN DEL SERVICIO</th>
            <th style="width:100px;">VEHÍCULO</th>
            <th class="r" style="width:115px;">PRECIO NETO / SERV.</th>
            <th class="r" style="width:75px;">FREC./MES</th>
            <th class="r" style="width:120px;">TOTAL MENSUAL</th>
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
                  <div style="font-size:10.5px;color:#374151;line-height:1.5;">${item.description}</div>
                  ${item.pasajeros ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px;">${item.pasajeros} pasajeros</div>` : ''}
                </td>
                <td>
                  ${vLabel ? `<span class="vbadge">${vLabel}</span>` : (item.codigo ?? '—')}
                </td>
                <td class="r">
                  <div class="price-net">${formatCLP(item.unit_price)}</div>
                  ${listaItem ? `<div class="price-list">${formatCLP(listaItem)}</div>` : ''}
                </td>
                <td class="r" style="color:#374151;">${item.quantity}</td>
                <td class="r">
                  <div style="font-weight:700;font-size:12px;">${formatCLP(totalItem)}</div>
                  ${descuentoPct > 0 ? `<div style="text-align:right;margin-top:2px;"><span class="disc-badge">-${descuentoPct}%</span></div>` : ''}
                </td>
              </tr>`
              }).join('')
          }
        </tbody>
      </table>
    </div>

    <div class="total-box">
      <div class="total-inner">
        ${descuentoPct > 0 ? `
        <div class="total-row">
          <span class="total-lbl">Precio lista</span>
          <span class="total-val">${formatCLP(Math.round(totalNeto / (1 - descuentoPct / 100)))}</span>
        </div>
        <div class="total-row">
          <span class="total-lbl">Descuento (${descuentoPct}%)</span>
          <span class="total-val" style="color:#d33a2c;">−${formatCLP(Math.round(totalNeto / (1 - descuentoPct / 100)) - totalNeto)}</span>
        </div>` : ''}
        <div class="total-row">
          <span class="total-lbl">Subtotal neto</span>
          <span class="total-val">${formatCLP(totalNeto)}</span>
        </div>
        <div class="total-row" style="background:#f9fafb;">
          <span class="total-lbl" style="font-size:9px;color:#9ca3af;">IVA (Exento — Decreto 80)</span>
          <span class="total-val" style="font-size:10px;color:#9ca3af;">$0</span>
        </div>
        <div class="total-row">
          <span>TOTAL MENSUAL</span>
          <span>${formatCLP(totalNeto)}</span>
        </div>
      </div>
    </div>

    ${q.observaciones ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:11px 14px;margin-bottom:14px;">
      <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:.07em;margin-bottom:5px;">Observaciones</div>
      <div style="font-size:11px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${q.observaciones}</div>
    </div>` : ''}

    <div class="page-footer" style="padding-top:10px;">
      <span>Transccl SpA · RUT 76.282.952-3 · ventas@transccl.cl · +56 2 2945 5713</span>
      <span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:3px 10px;color:${ACCENT};font-weight:700;">
        ${q.expiry_date ? `Válida hasta ${fmtDate(q.expiry_date)}` : 'Vigencia 15 días corridos'}
      </span>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════ PÁGINA 14: QUÉ INCLUYE + CONDICIONES -->
<div class="page">
  <div class="sp">
    ${sectionHeader(12, '¿Qué incluye nuestro servicio de Traslado Diario?')}

    <div class="inc-grid">
      <div class="inc-card">
        <div class="inc-title">Comercial y Operativo</div>
        <div class="inc-item">KAM (Key Account Manager)</div>
        <div class="inc-item">Protocolos de higiene vigentes</div>
        <div class="inc-item">Asesoramiento en ruta</div>
        <div class="inc-item">Departamento de operaciones</div>
        <div class="inc-item">Optimización de servicios</div>
        <div class="inc-item">Monitoreo GPS en tiempo real</div>
      </div>
      <div class="inc-card">
        <div class="inc-title">Vehículo</div>
        <div class="inc-item">TAG incluido</div>
        <div class="inc-item">Combustible incluido</div>
        <div class="inc-item">Peajes incluidos</div>
        <div class="inc-item">GPS y control de velocidad</div>
        <div class="inc-item">Aire acondicionado y calefacción</div>
        <div class="inc-item">SOAP y seguro de asiento</div>
        <div class="inc-item">Decreto N°80 (Santiago)</div>
      </div>
      <div class="inc-card">
        <div class="inc-title">Conductores</div>
        <div class="inc-item">Licencia profesional vigente</div>
        <div class="inc-item">Entrega de ODI</div>
        <div class="inc-item">Entrega de EPP</div>
        <div class="inc-item">Manejo a la defensiva</div>
        <div class="inc-item">Más de 3 años de experiencia</div>
        <div class="inc-item">Proceso de selección riguroso</div>
      </div>
      <div class="inc-card">
        <div class="inc-title">Plan de Contingencia</div>
        <div class="inc-item">Vehículo de reemplazo (mismas características)</div>
        <div class="inc-item">Activación en máximo 40 minutos</div>
        <div class="inc-item">Asistencia en ruta 24/7</div>
        <div class="inc-item">Conductor de reemplazo</div>
      </div>
      <div class="inc-card">
        <div class="inc-title">Taller Mecánico Propio</div>
        <div class="inc-item">Mantención preventiva y correctiva</div>
        <div class="inc-item">Checklist diario, semanal y mensual</div>
        <div class="inc-item">Disponible 24/7</div>
        <div class="inc-item">Margen de error &lt;5% anual</div>
      </div>
      <div class="inc-card">
        <div class="inc-title">Control y Medición KPI</div>
        <div class="inc-item">Monitoreo en tiempo real CMR</div>
        <div class="inc-item">Checklist preventivo de ruta diario</div>
        <div class="inc-item">Reportería mensual de efectividad</div>
        <div class="inc-item">Evaluación semestral y anual</div>
        <div class="inc-item">Control de usuarios en ruta</div>
      </div>
    </div>

    <div class="dark-box" style="margin-top:14px;">
      <div class="dark-box-title">Condiciones comerciales y proceso de contratación</div>
      <div class="dark-grid">
        <div><strong>Con crédito vigente:</strong><br/>Las OC deben emitirse al mismo RUT y giro de esta cotización. Facturación mensual al final del período.</div>
        <div><strong>Sin crédito:</strong><br/>Reserva con 50% del total mensual. El saldo se cancela antes del inicio del primer servicio.</div>
        <div><strong>Exención de IVA:</strong><br/>Transccl opera exenta de IVA bajo Decreto 80 MTT. El valor cotizado es el total final.</div>
        <div><strong>Vigencia:</strong><br/>Esta cotización es válida por 15 días corridos desde la fecha de emisión.</div>
        <div><strong>Garantía de servicio:</strong><br/>Incluye vehículo de contingencia, conductor de reemplazo y tráfico 24/7.</div>
        <div><strong>Contrato Flex:</strong><br/>Adaptamos el contrato a los ciclos operacionales de tu empresa: mensual, semestral o anual.</div>
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
