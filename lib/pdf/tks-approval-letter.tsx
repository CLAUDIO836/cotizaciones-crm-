import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const RED = '#C8102E'
const BORDER = '#d1d5db'
const GRAY = '#6b7280'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  logoText: { fontSize: 22, fontWeight: 'bold', color: RED },
  logoSub: { fontSize: 7, color: GRAY, marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: RED, textAlign: 'right' },
  docDate: { fontSize: 8, color: GRAY, marginTop: 4, textAlign: 'right' },
  divider: { borderBottomWidth: 2, borderBottomColor: RED, marginBottom: 14 },
  sectionHeader: { backgroundColor: RED, padding: '4 8', marginBottom: 0 },
  sectionHeaderText: { color: 'white', fontWeight: 'bold', fontSize: 8 },
  table: { border: `1 solid ${BORDER}`, marginBottom: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  tableLabel: { width: 110, padding: '4 6', fontSize: 7.5, color: GRAY, borderRightWidth: 1, borderRightColor: BORDER },
  tableValue: { flex: 1, padding: '4 6', fontSize: 8, fontWeight: 'bold' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '10 14', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4, marginBottom: 12 },
  totalLabel: { fontSize: 10, fontWeight: 'bold', color: RED },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: RED },
  policyTitle: { fontSize: 8, fontWeight: 'bold', color: '#111827', marginBottom: 2, marginTop: 6 },
  policyBullet: { fontSize: 7.5, color: '#4b5563', marginBottom: 2, marginLeft: 6, lineHeight: 1.5 },
  bankBox: { backgroundColor: '#f9fafb', padding: '8 10', marginTop: 8, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: BORDER },
  bankTitle: { fontSize: 8, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  bankRow: { flexDirection: 'row', marginBottom: 2 },
  bankLabel: { width: 80, fontSize: 7, color: GRAY },
  bankValue: { fontSize: 7, fontWeight: 'bold' },
  signedBlock: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 10, marginTop: 12 },
  signatureRow: { flexDirection: 'row', gap: 20, marginTop: 20 },
  signatureField: { flex: 1 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 4 },
  signatureLabel: { fontSize: 7, color: GRAY },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  footerText: { fontSize: 6.5, color: GRAY },
})

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

const TKS_CLAUSES = [
  { title: '1. Confirmación de Cotización', bullets: ['Una vez aceptada la cotización, el cliente deberá confirmarla a través de correo electrónico dirigido a su asesor comercial, adjuntando copia de la cotización debidamente completada a mano.', 'Este documento constituye la aceptación formal del número de cotización señalado en el encabezado.', '⚠ No se podrán modificar horarios, comunas, regiones o países establecidos en la cotización inicial.'] },
  { title: '2. Reserva y Pago del Servicio', bullets: ['Para concluir el proceso de reserva, el cliente deberá enviar copia de la transferencia correspondiente al 50% del valor total del servicio.', 'El 50% restante deberá ser cancelado antes del inicio del servicio; de lo contrario, la salida no se realizará.', 'Todos los depósitos deben ser enviados con copia al asesor comercial encargado y a contabilidad@transportestks.com.'] },
  { title: '3. Carta de Aprobación', bullets: ['La carta de aprobación debe ser enviada con al menos 24 horas de anticipación.', 'No se aceptarán cambios con menos de 48 horas de anticipación al inicio del servicio.', '⚠ La carta de aprobación valida el servicio, pero no constituye reserva; la reserva es efectiva solo tras el depósito del 50%.'] },
  { title: '4. Garantía de Servicio', bullets: ['Al contratar con TKS, el cliente accede a una garantía que cubre:', '• Vehículos de contingencia activados en caso de imprevistos.', '• Cambio de unidad en caso de no cumplir lo comprometido.'] },
  { title: '5. Retrasos del Usuario', bullets: ['Si el usuario retrasa la salida del vehículo más de 30 minutos, se cobrará una hora adicional:', '• Van (7 a 19 pasajeros): $15.000 por hora.', '• Minibuses y buses (24+ pasajeros): $25.000 por hora.', '⚠ Estos montos no aplican a servicios contratados a valor promocional.'] },
  { title: '6. Suspensión del Servicio', bullets: ['Suspensión con menos de 48 horas: no se devolverá el abono del 50%.', 'Suspensión el mismo día: el cliente deberá cancelar el 100% del servicio contratado.'] },
  { title: '7. Responsabilidad sobre Pertenencias', bullets: ['Todas las pertenencias y objetos de valor son responsabilidad exclusiva del cliente.', 'TKS no se hace responsable por pérdidas o daños.', 'En servicios de ida y retorno, el cliente debe verificar que no queden objetos dentro del vehículo.'] },
  { title: '8. Observaciones', bullets: ['El cliente podrá realizar observaciones al momento de la llegada del vehículo.', 'Una vez iniciado el servicio, no se aceptarán reclamos.'] },
  { title: '9. Devoluciones', bullets: ['No se realizan devoluciones de dinero.', 'Cualquier saldo a favor de TKS se abonará a un próximo servicio.'] },
  { title: '10. Prestación de Servicios', bullets: ['TKS cuenta con vehículos propios y externos de socios estratégicos en contrato, quienes se encuentran alineados a prestar el servicio en las condiciones comprometidas.'] },
  { title: '11. Opiniones y Reclamos', bullets: ['El cliente podrá enviar comentarios a oirs@transportestks.com.', 'La empresa generará un análisis de gestión y responderá en un plazo máximo de 3 días hábiles.'] },
  { title: '12. Protección de Datos Personales (Ley 19.628)', bullets: ['Los datos personales recopilados serán tratados conforme a la Ley N° 19.628. Serán utilizados exclusivamente para la prestación del servicio. El titular tiene derecho a solicitar su modificación o eliminación.'] },
  { title: '13. Validez de Firma Digital (Ley 19.799)', bullets: ['La firma electrónica simple aplicada tiene plena validez conforme a la Ley N° 19.799 sobre Documentos Electrónicos y Firma Electrónica. La aceptación digital tiene el mismo efecto jurídico que una firma manuscrita.'] },
]

export interface TKSApprovalLetterData {
  client_name: string
  client_rut?: string
  client_email?: string
  client_phone?: string
  contact_name?: string
  seller_name?: string
  desde?: string
  hasta?: string
  fecha_salida?: string
  hora_salida?: string
  fecha_retorno?: string
  hora_retorno?: string
  total?: number
  billing_name?: string
  billing_rut?: string
  billing_address?: string
  billing_glosa?: string
  signed_at?: string
  signed_name?: string
  signed_rut?: string
  signed_ip?: string
  token?: string
}

export function TKSApprovalLetterPDF({ data }: { data: TKSApprovalLetterData }) {
  const now = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.logoText}>TKs</Text>
            <Text style={styles.logoSub}>Transportes TKS SpA</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>CARTA DE APROBACIÓN DE SERVICIO</Text>
            <Text style={styles.docDate}>Santiago, {now}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Client data */}
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>DATOS DEL CONTRATANTE</Text></View>
        <View style={styles.table}>
          {[
            ['Empresa / Persona', data.client_name],
            data.client_rut ? ['RUT', data.client_rut] : null,
            data.contact_name ? ['Contacto', data.contact_name] : null,
            data.client_email ? ['Email', data.client_email] : null,
            data.client_phone ? ['Teléfono', data.client_phone] : null,
          ].filter((x): x is string[] => x !== null).map(([label, value]) => (
            <View key={label} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{label}</Text>
              <Text style={styles.tableValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Service detail */}
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>DETALLE DEL SERVICIO</Text></View>
        <View style={styles.table}>
          {[
            data.desde ? ['Origen', data.desde] : null,
            data.hasta ? ['Destino', data.hasta] : null,
            data.fecha_salida ? ['Fecha y hora salida', `${data.fecha_salida}${data.hora_salida ? ` a las ${data.hora_salida}` : ''}`] : null,
            data.fecha_retorno ? ['Fecha y hora retorno', `${data.fecha_retorno}${data.hora_retorno ? ` a las ${data.hora_retorno}` : ''}`] : null,
            data.seller_name ? ['Ejecutivo', data.seller_name] : null,
          ].filter((x): x is string[] => x !== null).map(([label, value]) => (
            <View key={label} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{label}</Text>
              <Text style={styles.tableValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        {data.total != null && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>ME COMPROMETO A CANCELAR EL SIGUIENTE MONTO</Text>
            <Text style={styles.totalValue}>{formatCLP(data.total)}</Text>
          </View>
        )}

        {/* Billing */}
        {data.billing_name && (
          <>
            <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>DATOS DE FACTURACIÓN</Text></View>
            <View style={[styles.table, { marginBottom: 10 }]}>
              {[
                ['Razón social', data.billing_name],
                data.billing_rut ? ['RUT', data.billing_rut] : null,
                data.billing_address ? ['Dirección', data.billing_address] : null,
                data.billing_glosa ? ['Glosa', data.billing_glosa] : null,
              ].filter((x): x is string[] => x !== null).map(([label, value]) => (
                <View key={label} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{label}</Text>
                  <Text style={styles.tableValue}>{value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bank data */}
        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>Datos de transferencia para reserva (50%):</Text>
          {[['Banco', 'Banco de Crédito e Inversiones'], ['Swift', 'CREDCLRM'], ['Nombre', 'Claudio Chuhaicura López'], ['RUT', '14.395.747-0'], ['Cta. Corriente', '27975631'], ['Email', 'contabilidad@transportestks.com']].map(([l, v]) => (
            <View key={l} style={styles.bankRow}>
              <Text style={styles.bankLabel}>{l}:</Text>
              <Text style={styles.bankValue}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Clauses */}
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>TÉRMINOS Y CONDICIONES</Text></View>
        {TKS_CLAUSES.map(c => (
          <View key={c.title}>
            <Text style={styles.policyTitle}>{c.title}</Text>
            {c.bullets.map((b, i) => <Text key={i} style={styles.policyBullet}>• {b}</Text>)}
          </View>
        ))}

        {/* Signature */}
        {data.signed_at ? (
          <View style={styles.signedBlock}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>DOCUMENTO FIRMADO DIGITALMENTE — Ley 19.799</Text>
            <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>Nombre: {data.signed_name}</Text>
            <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>RUT: {data.signed_rut}</Text>
            <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>Fecha firma: {new Date(data.signed_at).toLocaleString('es-CL')}</Text>
            {data.signed_ip && <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>IP: {data.signed_ip}</Text>}
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 4 }}>Token: {data.token}</Text>
          </View>
        ) : (
          <View style={styles.signatureRow}>
            <View style={styles.signatureField}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>NOMBRE REPRESENTANTE</Text></View>
            <View style={styles.signatureField}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>RUT</Text></View>
            <View style={styles.signatureField}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>FIRMA Y TIMBRE</Text></View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Transportes TKS SpA · Carta de Aprobación de Servicio · oirs@transportestks.com</Text>
        </View>
      </Page>
    </Document>
  )
}
