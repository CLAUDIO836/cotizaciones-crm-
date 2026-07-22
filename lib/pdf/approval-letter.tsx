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
  {
    title: '1. Objeto del Contrato',
    text: 'El prestador de servicios se obliga a proporcionar el servicio de transporte indicado en la presente carta, en las fechas, horarios y lugares especificados, con los medios de transporte y conductores idóneos para tal efecto.',
  },
  {
    title: '2. Precio y Forma de Pago',
    text: 'El precio total del servicio es el indicado en la presente carta. El pago deberá realizarse según las condiciones acordadas entre las partes. En caso de no mediar acuerdo expreso, el pago será al contado al momento de la prestación del servicio.',
  },
  {
    title: '3. Modificaciones y Cancelaciones',
    text: 'Cualquier modificación o cancelación del servicio deberá ser comunicada con al menos 48 horas de anticipación. Cancelaciones con menos de 24 horas de anticipación podrán estar sujetas a cobros por gastos incurridos.',
  },
  {
    title: '4. Responsabilidad del Prestador',
    text: 'El prestador se obliga a ejecutar el servicio con la debida diligencia y cuidado, garantizando la seguridad de los pasajeros durante el trayecto. El prestador cuenta con los seguros legalmente exigidos para la operación de vehículos de transporte de pasajeros.',
  },
  {
    title: '5. Responsabilidad del Contratante',
    text: 'El contratante se compromete a tener a los pasajeros listos en el punto de encuentro acordado en el horario establecido. El contratante es responsable del comportamiento de los pasajeros durante el servicio.',
  },
  {
    title: '6. Equipaje y Pertenencias',
    text: 'El prestador no se hace responsable por pérdida, daño o extravío de objetos personales, equipaje u otras pertenencias dejadas en los vehículos. Se recomienda a los pasajeros no dejar objetos de valor.',
  },
  {
    title: '7. Puntualidad',
    text: 'El prestador se compromete a cumplir con los horarios acordados. Retrasos superiores a 30 minutos no imputables al contratante o a causas de fuerza mayor darán derecho a una compensación a convenir entre las partes.',
  },
  {
    title: '8. Fuerza Mayor',
    text: 'Ninguna de las partes será responsable por incumplimientos debidos a causas de fuerza mayor o caso fortuito, incluyendo pero no limitándose a condiciones climáticas adversas, accidentes de tránsito, restricciones gubernamentales o eventos imprevisibles.',
  },
  {
    title: '9. Conductor y Vehículo',
    text: 'El prestador garantiza que el conductor asignado contará con la licencia de conducir vigente y habilitación correspondiente. El vehículo estará en óptimas condiciones mecánicas y cumplirá con la normativa vigente para el transporte de pasajeros.',
  },
  {
    title: '10. Derecho a Retiro',
    text: 'El prestador se reserva el derecho de suspender el servicio si el comportamiento de los pasajeros pone en riesgo la seguridad del viaje, sin que ello genere obligación de devolución del monto pagado.',
  },
  {
    title: '11. Resolución de Disputas',
    text: 'Cualquier controversia derivada de la presente carta de aprobación será resuelta de mutuo acuerdo entre las partes. En caso de no llegarse a acuerdo, se someterán a la jurisdicción de los Tribunales Ordinarios de Justicia de la ciudad de Santiago, Chile.',
  },
  {
    title: '12. Confidencialidad',
    text: 'Las partes se comprometen a mantener la confidencialidad de la información comercial y personal intercambiada en el marco del presente servicio, salvo requerimiento de autoridad competente.',
  },
  {
    title: '13. Cesión',
    text: 'El contratante no podrá ceder o transferir sus derechos u obligaciones derivados de la presente carta de aprobación a terceros sin el consentimiento previo y por escrito del prestador.',
  },
  {
    title: '14. Integridad del Acuerdo',
    text: 'La presente carta de aprobación constituye el acuerdo completo entre las partes respecto al servicio indicado y deja sin efecto cualquier comunicación o acuerdo previo sobre el mismo objeto.',
  },
  {
    title: '15. Protección de Datos Personales (Ley 19.628)',
    text: 'Los datos personales recopilados en el presente documento serán tratados conforme a la Ley N° 19.628 sobre Protección de la Vida Privada. Serán utilizados exclusivamente para la prestación del servicio y comunicaciones relacionadas. El titular tiene derecho a solicitar su modificación, eliminación o bloqueo en cualquier momento.',
  },
  {
    title: '16. Validez de Firma Digital (Ley 19.799)',
    text: 'La firma electrónica simple aplicada en este documento tiene plena validez conforme a la Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación de dicha firma. La aceptación digital del presente documento tiene el mismo efecto jurídico que una firma manuscrita.',
  },
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
            <Text style={styles.companyRut}>RUT: 76.282.952-3</Text>
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

        {/* Datos de facturación si difieren */}
        {data.billing_name && (
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
