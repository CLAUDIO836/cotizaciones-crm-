import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, alignItems: 'flex-start' },
  company: { fontSize: 16, fontWeight: 'bold', color: '#1B8A4B' },
  companyRut: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: '#111827', textAlign: 'right' },
  docDate: { fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'right' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 18 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { color: '#6b7280', width: 110, fontSize: 9 },
  value: { flex: 1, fontSize: 9, fontWeight: 'bold', color: '#111827' },
  section: { marginBottom: 18 },
  clauseTitle: { fontSize: 9, fontWeight: 'bold', color: '#374151', marginBottom: 3 },
  clauseText: { fontSize: 8.5, color: '#4b5563', marginBottom: 10 },
  totalBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontWeight: 'bold', color: '#166534' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#166534' },
  signatureBox: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginTop: 30,
    paddingTop: 12,
  },
  signedBlock: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, padding: 10, marginTop: 12 },
  footer: { position: 'absolute', bottom: 30, left: 50, right: 50, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 6 },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
})

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

const CLAUSES = [
  { title: '1. Objeto del Contrato', text: 'El prestador se obliga a proporcionar el servicio de transporte indicado en la presente carta, en las fechas, horarios y lugares especificados, con medios de transporte y conductores idóneos.' },
  { title: '2. Confirmación y validez del documento', text: 'Este documento constituye la aceptación formal del servicio indicado en su encabezado. La firma electrónica aplicada tiene plena validez conforme a la Ley N° 19.799 y equivale a una firma manuscrita.' },
  { title: '3. Restricción de modificaciones post-firma', text: 'Una vez firmada esta carta, no se podrán modificar horarios, comunas, regiones ni países establecidos. Cualquier cambio deberá acordarse por escrito y puede implicar ajuste de precio.' },
  { title: '4. Reserva y forma de pago', text: 'Para servicios al contado (50%+50%): 50% al reservar y 50% antes del inicio del servicio; de lo contrario el vehículo no saldrá. Transferir a Transportes TransCCL · RUT 77.282.952-3 · Banco BCI · Cta. Cte. N° 46704906. Enviar comprobante a contabilidad@transccl.cl.' },
  { title: '5. Devoluciones y créditos', text: 'No se realizan devoluciones de dinero. Cualquier saldo a favor será abonado como crédito para un próximo servicio, vigente por 6 meses.' },
  { title: '6. Cancelación y suspensión del servicio', text: '+48 horas de anticipación: sin cargo. Menos de 24 horas: se pierde el abono del 50%. El mismo día: se cancela el 100% del valor total.' },
  { title: '7. Cobros por retraso del contratante', text: 'Retraso superior a 30 min imputable al cliente: Van (7–19 pax) $15.000/hr · Minibús y bus (20+ pax) $25.000/hr. No aplica a tarifas promocionales.' },
  { title: '8. Garantía del servicio', text: 'TransCCL garantiza la continuidad mediante vehículos de contingencia, cambio de unidad si la asignada no cumple lo solicitado, y supervisión diaria de operación.' },
  { title: '9. Seguridad y condiciones del vehículo', text: 'Vehículos inspeccionados diariamente. Al abordar, el cliente debe verificar que todos los cinturones estén presentes y en correcto estado. Anomalías deben informarse de inmediato antes del inicio del viaje.' },
  { title: '10. Conductor y vehículo asignado', text: 'El conductor contará con licencia vigente y el vehículo cumplirá la normativa de transporte de pasajeros.' },
  { title: '11. Prestación de servicios y socios', text: 'TransCCL opera con flota propia y socios estratégicos alineados a nuestras políticas de calidad. TransCCL responde directamente ante el contratante en todos los casos.' },
  { title: '12. Responsabilidad del prestador', text: 'TransCCL ejecuta el servicio con la debida diligencia y cuenta con los seguros legalmente exigidos para transporte de pasajeros.' },
  { title: '13. Responsabilidad del contratante', text: 'El contratante es responsable del comportamiento de los pasajeros y de cualquier daño ocasionado al vehículo durante el servicio.' },
  { title: '14. Equipaje y pertenencias', text: 'TransCCL no se hace responsable por pérdida, daño o extravío de objetos personales o equipaje dejados en los vehículos.' },
  { title: '15. Garantía por daños al vehículo', text: 'En caso de daños imputables a los pasajeros, se exigirá una garantía en dinero que será devuelta de inmediato si no se registran daños al finalizar el servicio.' },
  { title: '16. Observaciones y reclamos en ruta', text: 'Observaciones sobre la unidad se aceptan solo al momento de la llegada del vehículo, antes del inicio. Una vez en trayecto no se aceptan reclamos sobre la unidad. Reclamos a contabilidad@transccl.cl — respuesta en 3 días hábiles.' },
  { title: '17. Derecho a retiro', text: 'TransCCL puede suspender el servicio si el comportamiento de los pasajeros pone en riesgo la seguridad, sin obligación de devolución.' },
  { title: '18. Cumplimiento normativo', text: 'TransCCL cumple el Decreto N° 80 del Ministerio de Transporte y todas las exigencias de seguridad vial vigentes.' },
  { title: '19. Fuerza mayor y resolución de disputas', text: 'Ninguna parte responde por fuerza mayor. Controversias se resuelven de mutuo acuerdo; de no lograrse, ante los Tribunales Ordinarios de Justicia de Santiago.' },
  { title: '20. Protección de datos y firma digital', text: 'Datos personales tratados conforme a la Ley N° 19.628, exclusivamente para la prestación del servicio. Firma electrónica con validez legal Ley N° 19.799.' },
]

export interface ApprovalLetterData {
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
  company_name?: string
  billing_name?: string
  billing_rut?: string
  billing_address?: string
  billing_company?: string
  billing_glosa?: string
  signed_at?: string
  signed_name?: string
  signed_rut?: string
  signed_ip?: string
  token?: string
}

export function ApprovalLetterPDF({ data }: { data: ApprovalLetterData }) {
  const company = data.company_name ?? 'Transccl SpA'
  const now = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{company}</Text>
            <Text style={styles.companyRut}>RUT: 77.282.952-3</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>CARTA DE APROBACIÓN DE SERVICIO</Text>
            <Text style={styles.docDate}>Santiago, {now}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Contratante</Text>
          <View style={styles.row}><Text style={styles.label}>Empresa / Persona:</Text><Text style={styles.value}>{data.client_name}</Text></View>
          {data.client_rut && <View style={styles.row}><Text style={styles.label}>RUT:</Text><Text style={styles.value}>{data.client_rut}</Text></View>}
          {data.contact_name && <View style={styles.row}><Text style={styles.label}>Contacto:</Text><Text style={styles.value}>{data.contact_name}</Text></View>}
          {data.client_email && <View style={styles.row}><Text style={styles.label}>Email:</Text><Text style={styles.value}>{data.client_email}</Text></View>}
          {data.client_phone && <View style={styles.row}><Text style={styles.label}>Teléfono:</Text><Text style={styles.value}>{data.client_phone}</Text></View>}
        </View>

        {/* Detalle del servicio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle del Servicio</Text>
          {data.desde && <View style={styles.row}><Text style={styles.label}>Origen:</Text><Text style={styles.value}>{data.desde}</Text></View>}
          {data.hasta && <View style={styles.row}><Text style={styles.label}>Destino:</Text><Text style={styles.value}>{data.hasta}</Text></View>}
          {data.fecha_salida && (
            <View style={styles.row}>
              <Text style={styles.label}>Fecha y hora salida:</Text>
              <Text style={styles.value}>{data.fecha_salida}{data.hora_salida ? ` a las ${data.hora_salida}` : ''}</Text>
            </View>
          )}
          {data.fecha_retorno && (
            <View style={styles.row}>
              <Text style={styles.label}>Fecha y hora retorno:</Text>
              <Text style={styles.value}>{data.fecha_retorno}{data.hora_retorno ? ` a las ${data.hora_retorno}` : ''}</Text>
            </View>
          )}
          {data.seller_name && <View style={styles.row}><Text style={styles.label}>Ejecutivo:</Text><Text style={styles.value}>{data.seller_name}</Text></View>}
        </View>

        {/* Total */}
        {data.total != null && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Valor Total del Servicio</Text>
            <Text style={styles.totalValue}>{formatCLP(data.total)}</Text>
          </View>
        )}

        {/* Datos de facturación si el RUT de facturación difiere del cliente */}
        {data.billing_rut && data.billing_rut !== data.client_rut && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos de Facturación</Text>
            <View style={styles.row}><Text style={styles.label}>Razón social:</Text><Text style={styles.value}>{data.billing_name}</Text></View>
            {data.billing_rut && <View style={styles.row}><Text style={styles.label}>RUT:</Text><Text style={styles.value}>{data.billing_rut}</Text></View>}
            {data.billing_address && <View style={styles.row}><Text style={styles.label}>Dirección:</Text><Text style={styles.value}>{data.billing_address}</Text></View>}
            {data.billing_glosa && <View style={styles.row}><Text style={styles.label}>Glosa:</Text><Text style={styles.value}>{data.billing_glosa}</Text></View>}
          </View>
        )}

        {/* Cláusulas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Términos y Condiciones</Text>
          {CLAUSES.map((c) => (
            <View key={c.title}>
              <Text style={styles.clauseTitle}>{c.title}</Text>
              <Text style={styles.clauseText}>{c.text}</Text>
            </View>
          ))}
        </View>

        {/* Firma */}
        {data.signed_at ? (
          <View style={styles.signedBlock}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>DOCUMENTO FIRMADO DIGITALMENTE</Text>
            <View style={styles.row}><Text style={styles.label}>Nombre:</Text><Text style={styles.value}>{data.signed_name}</Text></View>
            <View style={styles.row}><Text style={styles.label}>RUT:</Text><Text style={styles.value}>{data.signed_rut}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Fecha firma:</Text><Text style={styles.value}>{new Date(data.signed_at).toLocaleString('es-CL')}</Text></View>
            {data.signed_ip && <View style={styles.row}><Text style={styles.label}>IP:</Text><Text style={styles.value}>{data.signed_ip}</Text></View>}
            <Text style={{ fontSize: 7.5, color: '#6b7280', marginTop: 6 }}>
              Firma válida según Ley N° 19.799 sobre Firma Electrónica. Token: {data.token}
            </Text>
          </View>
        ) : (
          <View style={styles.signatureBox}>
            <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 20 }}>
              Al firmar digitalmente este documento, el contratante declara haber leído, comprendido y aceptado todos los términos y condiciones precedentes.
            </Text>
            <View style={{ flexDirection: 'row', gap: 40 }}>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 4 }} />
                <Text style={{ fontSize: 8, color: '#6b7280' }}>Firma Contratante</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 4 }} />
                <Text style={{ fontSize: 8, color: '#6b7280' }}>Firma {company}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {company} · Carta de Aprobación de Servicio · Documento electrónico generado automáticamente
          </Text>
        </View>
      </Page>
    </Document>
  )
}
