export function buildQuotationEmailHtml(opts: {
  clientName:      string
  clientEmail?:    string
  quotationNumber: string
  total:           number
  desde?:          string
  hasta?:          string
  fechaSalida?:    string
  cartaUrl:        string
  vendorName?:     string
  vendorEmail?:    string
  vendorPhone?:    string
  isStaging?:      boolean
}): string {
  const {
    clientName, clientEmail, quotationNumber, total,
    desde, hasta, fechaSalida, cartaUrl,
    vendorName = 'TransCCL Ventas',
    vendorEmail = 'ventas@transccl.cl',
    vendorPhone = '+56 2 2945 5713',
    isStaging,
  } = opts

  const tipoServicio = desde && hasta
    ? `${desde} → ${hasta}`
    : 'Servicio de transporte de pasajeros'

  const fechaFmt = fechaSalida
    ? new Date(fechaSalida + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const stagingBanner = isStaging
    ? `<tr><td style="background:#fbbf24;color:#78350f;padding:8px 16px;font-size:12px;font-weight:700;text-align:center">⚠️ PRUEBA STAGING — Destinatario real sería: ${clientEmail ?? ''}</td></tr>`
    : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#1c3050">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-collapse:collapse">
  ${stagingBanner}
  <!-- Header -->
  <tr><td style="background:#082e62;padding:24px 30px;color:white;border-bottom:5px solid #e52832">
    <div style="font-size:30px;font-weight:800;letter-spacing:-1px">Trans<span style="color:#7fc76a">ccl</span></div>
    <div style="font-size:12px;margin-top:5px;color:#d7e4f4">Transportes de Pasajeros</div>
  </td></tr>

  <!-- Hero -->
  <tr><td style="background:#e9f3fb;padding:28px 30px">
    <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#267c49">UNA SOLUCIÓN PENSADA PARA SU VIAJE</div>
    <div style="font-size:30px;line-height:1.2;font-weight:800;color:#082e62;margin-top:8px">Su propuesta de transporte está lista</div>
    <div style="font-size:15px;line-height:1.6;margin-top:10px">Seguridad, comodidad y coordinación en cada traslado.</div>
  </td></tr>

  <!-- Intro -->
  <tr><td style="padding:27px 30px 12px;font-size:15px;line-height:1.7">
    <p style="margin:0 0 15px">Estimado/a <strong>${clientName || 'cliente'}</strong>:</p>
    <p style="margin:0 0 15px">Gracias por considerar a <strong>Transportes Transccl</strong>. Hemos preparado la cotización <strong>${quotationNumber}</strong> para el servicio solicitado, buscando una alternativa adecuada a sus necesidades.</p>
    <p style="margin:0">En Transccl creemos que un buen viaje comienza mucho antes de subir al vehículo: con planificación, atención y compromiso con cada pasajero.</p>
  </td></tr>

  <!-- Detalle servicio -->
  <tr><td style="padding:12px 30px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7fb;border-left:4px solid #2e944a">
    <tr><td style="padding:17px 20px">
      <div style="font-size:12px;color:#667890">SERVICIO SOLICITADO</div>
      <div style="font-size:17px;font-weight:700;margin-top:5px">${tipoServicio}</div>
      ${fechaFmt ? `<div style="font-size:13px;margin-top:5px;color:#52637c">📅 ${fechaFmt}</div>` : ''}
      <div style="font-size:13px;margin-top:7px;color:#52637c">Detalle y condiciones en la cotización PDF adjunta.</div>
    </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding:0 30px 27px">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr><td bgcolor="#e52832" style="border-radius:7px">
      <a href="${cartaUrl}" style="display:inline-block;padding:16px 26px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">REVISAR MI COTIZACIÓN</a>
    </td></tr>
    </table>
    <div style="font-size:12px;color:#667890;margin-top:12px">También encontrará el documento adjunto en PDF.</div>
  </td></tr>

  <!-- Texto cierre -->
  <tr><td style="padding:0 30px 25px;font-size:15px;line-height:1.7">
    <p style="margin:0 0 15px">¿Desea revisar algún detalle o realizar un ajuste? Responda este correo y le ayudaremos a coordinar la mejor alternativa.</p>
    <p style="margin:0">Será un gusto acompañarle en su próximo viaje.</p>
  </td></tr>

  <!-- Firma ejecutivo -->
  <tr><td style="background:#f4f7fb;padding:22px 30px;border-top:1px solid #e1e8f0">
    <div style="font-size:16px;font-weight:800;color:#082e62">${vendorName}</div>
    <div style="font-size:13px;color:#566b86;margin-top:3px">Ejecutiva de Ventas | Transportes Transccl</div>
    <div style="font-size:13px;margin-top:10px">${vendorPhone} · <a href="mailto:${vendorEmail}" style="color:#0d4b89">${vendorEmail}</a></div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#082e62;text-align:center;padding:22px 25px;color:white">
    <div style="font-size:17px;font-weight:800">Personas que cuidamos personas.</div>
    <div style="font-size:13px;margin-top:7px;color:#dce8f7">Disfruta el placer de viajar cómodos y seguros.</div>
    <div style="font-size:12px;margin-top:13px"><a href="https://www.transccl.cl" style="color:#ffffff">www.transccl.cl</a> · 22 945 5713</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}
