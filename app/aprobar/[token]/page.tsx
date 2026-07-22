import { notFound } from 'next/navigation'
import ApprovalForm from './ApprovalForm'

const CCL_CLAUSES = [
  { title: '1. Objeto del Contrato', text: 'El prestador de servicios se obliga a proporcionar el servicio de transporte indicado en la presente carta, en las fechas, horarios y lugares especificados, con los medios de transporte y conductores idóneos para tal efecto.' },
  { title: '2. Precio y Forma de Pago', text: 'El precio total del servicio es el indicado en la presente carta. El pago deberá realizarse según las condiciones acordadas entre las partes. En caso de no mediar acuerdo expreso, el pago será al contado al momento de la prestación del servicio.' },
  { title: '3. Modificaciones y Cancelaciones', text: 'Cualquier modificación o cancelación del servicio deberá ser comunicada con al menos 48 horas de anticipación. Cancelaciones con menos de 24 horas de anticipación podrán estar sujetas a cobros por gastos incurridos.' },
  { title: '4. Responsabilidad del Prestador', text: 'El prestador se obliga a ejecutar el servicio con la debida diligencia y cuidado, garantizando la seguridad de los pasajeros durante el trayecto. El prestador cuenta con los seguros legalmente exigidos para la operación de vehículos de transporte de pasajeros.' },
  { title: '5. Responsabilidad del Contratante', text: 'El contratante se compromete a tener a los pasajeros listos en el punto de encuentro acordado en el horario establecido. El contratante es responsable del comportamiento de los pasajeros durante el servicio.' },
  { title: '6. Equipaje y Pertenencias', text: 'El prestador no se hace responsable por pérdida, daño o extravío de objetos personales, equipaje u otras pertenencias dejadas en los vehículos. Se recomienda a los pasajeros no dejar objetos de valor.' },
  { title: '7. Puntualidad', text: 'El prestador se compromete a cumplir con los horarios acordados. Retrasos superiores a 30 minutos no imputables al contratante o a causas de fuerza mayor darán derecho a una compensación a convenir entre las partes.' },
  { title: '8. Fuerza Mayor', text: 'Ninguna de las partes será responsable por incumplimientos debidos a causas de fuerza mayor o caso fortuito, incluyendo pero no limitándose a condiciones climáticas adversas, accidentes de tránsito, restricciones gubernamentales o eventos imprevisibles.' },
  { title: '9. Conductor y Vehículo', text: 'El prestador garantiza que el conductor asignado contará con la licencia de conducir vigente y habilitación correspondiente. El vehículo estará en óptimas condiciones mecánicas y cumplirá con la normativa vigente para el transporte de pasajeros.' },
  { title: '10. Derecho a Retiro', text: 'El prestador se reserva el derecho de suspender el servicio si el comportamiento de los pasajeros pone en riesgo la seguridad del viaje, sin que ello genere obligación de devolución del monto pagado.' },
  { title: '11. Resolución de Disputas', text: 'Cualquier controversia derivada de la presente carta de aprobación será resuelta de mutuo acuerdo entre las partes. En caso de no llegarse a acuerdo, se someterán a la jurisdicción de los Tribunales Ordinarios de Justicia de la ciudad de Santiago, Chile.' },
  { title: '12. Confidencialidad', text: 'Las partes se comprometen a mantener la confidencialidad de la información comercial y personal intercambiada en el marco del presente servicio, salvo requerimiento de autoridad competente.' },
  { title: '13. Cesión', text: 'El contratante no podrá ceder o transferir sus derechos u obligaciones derivados de la presente carta de aprobación a terceros sin el consentimiento previo y por escrito del prestador.' },
  { title: '14. Integridad del Acuerdo', text: 'La presente carta de aprobación constituye el acuerdo completo entre las partes respecto al servicio indicado y deja sin efecto cualquier comunicación o acuerdo previo sobre el mismo objeto.' },
  { title: '15. Protección de Datos Personales (Ley 19.628)', text: 'Los datos personales recopilados en el presente documento serán tratados conforme a la Ley N° 19.628 sobre Protección de la Vida Privada. Serán utilizados exclusivamente para la prestación del servicio y comunicaciones relacionadas. El titular tiene derecho a solicitar su modificación, eliminación o bloqueo en cualquier momento.' },
  { title: '16. Validez de Firma Digital (Ley 19.799)', text: 'La firma electrónica simple aplicada en este documento tiene plena validez conforme a la Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación de dicha firma. La aceptación digital del presente documento tiene el mismo efecto jurídico que una firma manuscrita.' },
]

const TKS_CLAUSES = [
  { title: '1. Confirmación de Cotización', text: 'Una vez aceptada la cotización, el cliente deberá confirmarla por correo electrónico adjuntando la Carta de Aceptación firmada. No se podrán modificar horarios, comunas, regiones o países establecidos en la cotización inicial.' },
  { title: '2. Reserva y Pago del Servicio', text: 'Para reservar, se debe transferir el 50% del total del servicio. El 50% restante debe cancelarse antes del inicio; de lo contrario, la salida no se realizará. Banco BCI – Nombre: Claudio Chuhaicura López – RUT: 14.395.747-0 – Cta. Cte. 27975631. Copias a contabilidad@transportestks.com.' },
  { title: '3. Carta de Aprobación', text: 'La carta de aprobación debe ser enviada con al menos 24 horas de anticipación. No se aceptan cambios con menos de 48 horas. La reserva es válida solo tras confirmación de depósito del 50%.' },
  { title: '4. Garantía de Servicio', text: 'Al contratar con TKS, el cliente accede a vehículos de contingencia en caso de imprevistos y cambio de unidad si no se cumple lo comprometido.' },
  { title: '5. Retrasos del Usuario', text: 'Si hay retraso mayor a 30 min: Van (7–19 pax): $15.000 por hora extra. Minibuses y buses (24+ pax): $25.000 por hora extra. No aplica a valores promocionales.' },
  { title: '6. Suspensión del Servicio', text: 'Suspensión con menos de 48 horas: no se devuelve el abono. Suspensión el mismo día: se debe pagar el 100%.' },
  { title: '7. Responsabilidad sobre Pertenencias', text: 'La empresa no se hace responsable por pérdidas o daños. El cliente debe verificar que no queden objetos en el vehículo. Será responsable por daños ocasionados al mismo.' },
  { title: '8. Observaciones', text: 'Se aceptan solo al llegar el vehículo, no durante el servicio.' },
  { title: '9. Devoluciones', text: 'No se realizan devoluciones. Los saldos a favor se abonan a futuros servicios.' },
  { title: '10. Prestación de Servicios', text: 'TKS cuenta con flota propia y socios estratégicos alineados a estándares de calidad y seguridad.' },
  { title: '11. Opiniones y Reclamos', text: 'Los comentarios se deben enviar a oirs@transportestks.com. Se responderán en máximo 3 días hábiles.' },
  { title: '12. Protección de Datos (Ley 19.628)', text: 'Los datos personales serán tratados conforme a la Ley N° 19.628 y utilizados exclusivamente para la prestación del servicio.' },
  { title: '13. Validez de Firma Digital (Ley 19.799)', text: 'La aceptación digital tiene plena validez conforme a la Ley N° 19.799 sobre Firma Electrónica y el mismo efecto jurídico que una firma manuscrita.' },
]

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

export default async function AprobarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'
  let approval: Record<string, string> | null = null
  try {
    const res = await fetch(`${CRM_API}?action=approvals_get&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const json = await res.json()
    approval = json.data ?? null
  } catch { /* fall through to notFound */ }

  if (!approval) notFound()

  const isTKS = (approval.company_name ?? '').includes('TKS')
  const ACCENT = isTKS ? '#C8102E' : '#1B8A4B'
  const ACCENT_LIGHT = isTKS ? '#fef2f2' : '#f0fdf4'
  const ACCENT_BORDER = isTKS ? '#fca5a5' : '#86efac'
  const ACCENT_TEXT = isTKS ? '#991b1b' : '#166534'
  const CLAUSES = isTKS ? TKS_CLAUSES : CCL_CLAUSES

  const companyLabel = isTKS ? 'TKS' : 'Transccl'
  const companyFull = isTKS ? 'Transportes TKS SpA' : 'Transccl SpA'

  const items: { description: string; quantity: number; unit_price: number; subtotal: number }[] =
    typeof approval.items === 'string' ? JSON.parse(approval.items || '[]') : (approval.items ?? [])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#16192A', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {isTKS
          ? <img src="/vehicles/tks-logo.png" alt="TKs" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
          : <>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>T</span>
              </div>
              <div>
                <p style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: 14 }}>{companyFull}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 11 }}>Aprobación de Cotización</p>
              </div>
            </>
        }
        {isTKS && (
          <div>
            <p style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: 14 }}>{companyFull}</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 11 }}>Aprobación de Cotización</p>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Ya respondida */}
        {approval.response && (
          <AlreadyResponded approval={approval} accent={ACCENT} accentLight={ACCENT_LIGHT} accentBorder={ACCENT_BORDER} accentText={ACCENT_TEXT} />
        )}

        {!approval.response && (
          <>
            {/* Datos del servicio */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ background: ACCENT, padding: '10px 20px' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle del Servicio</h2>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                  <Row label="Empresa" value={approval.client_name} />
                  {approval.client_rut && <Row label="RUT" value={approval.client_rut} />}
                  {approval.desde && <Row label="Origen" value={approval.desde} />}
                  {approval.hasta && <Row label="Destino" value={approval.hasta} />}
                  {approval.fecha_salida && (
                    <Row label="Fecha salida" value={`${approval.fecha_salida}${approval.hora_salida ? ` a las ${approval.hora_salida}` : ''}`} />
                  )}
                  {approval.fecha_retorno && (
                    <Row label="Fecha retorno" value={`${approval.fecha_retorno}${approval.hora_retorno ? ` a las ${approval.hora_retorno}` : ''}`} />
                  )}
                  {approval.seller_name && <Row label="Ejecutivo" value={approval.seller_name} />}
                </div>

                {approval.total && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: ACCENT_LIGHT, borderRadius: 10, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT_TEXT }}>
                      {isTKS ? 'ME COMPROMETO A CANCELAR EL SIGUIENTE MONTO' : 'Total del servicio'}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT_TEXT }}>{formatCLP(Number(approval.total))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ítems */}
            {items.length > 0 && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ background: '#374151', padding: '10px 20px' }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle de Ítems</h2>
                </div>
                <div style={{ padding: '0 0 4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ textAlign: 'left', padding: '8px 16px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 50 }}>Cant.</th>
                        <th style={{ textAlign: 'right', padding: '8px 16px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 110 }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 16px', color: '#111827' }}>{item.description}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#6b7280' }}>{item.quantity}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{formatCLP(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Datos bancarios TKS */}
            {isTKS && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ background: '#374151', padding: '10px 20px' }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos de Transferencia (Reserva 50%)</h2>
                </div>
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Banco', 'Banco de Crédito e Inversiones (BCI)'],
                    ['Nombre', 'Claudio Chuhaicura López'],
                    ['RUT', '14.395.747-0'],
                    ['Cta. Corriente', '27975631'],
                    ['Email contabilidad', 'contabilidad@transportestks.com'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#6b7280', width: 140, flexShrink: 0 }}>{label}:</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Términos y condiciones */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ background: '#374151', padding: '10px 20px' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Términos y Condiciones</h2>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '14px 20px' }}>
                {CLAUSES.map(c => (
                  <div key={c.title} style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: '#374151' }}>{c.title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{c.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario de respuesta */}
            <ApprovalForm token={token} quotationId={approval.quotation_id} accent={ACCENT} accentLight={ACCENT_LIGHT} accentBorder={ACCENT_BORDER} accentText={ACCENT_TEXT} companyLabel={companyLabel} />
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</p>
    </div>
  )
}

function AlreadyResponded({ approval, accent, accentLight, accentBorder, accentText }: {
  approval: Record<string, string>
  accent: string; accentLight: string; accentBorder: string; accentText: string
}) {
  const accepted = approval.response === 'accepted'
  return (
    <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${accepted ? accentBorder : '#fca5a5'}`, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: accepted ? accentLight : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        {accepted
          ? <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          : <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        }
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        {accepted ? 'Cotización aceptada' : 'Cotización rechazada'}
      </h2>
      <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 14 }}>
        Respondida por: <strong>{approval.responded_name}</strong>
      </p>
      <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 13 }}>
        {new Date(approval.responded_at).toLocaleString('es-CL')}
      </p>
      {approval.rejection_reason && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>Motivo: {approval.rejection_reason}</p>
        </div>
      )}
    </div>
  )
}
