import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'
import path from 'path'

const TKS_LOGO = path.join(process.cwd(), 'public', 'vehicles', 'tks-logo.png')

const RED = '#C8102E'
const DARK = '#1a1a1a'
const GRAY = '#6b7280'
const LIGHTGRAY = '#f3f4f6'
const BORDER = '#d1d5db'

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 9, color: DARK },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { fontSize: 22, fontWeight: 'bold', color: RED, letterSpacing: -0.5 },
  logoSub: { fontSize: 7, color: GRAY, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  cotNum: { fontSize: 16, fontWeight: 'bold', color: RED },
  headerLabel: { fontSize: 7, color: GRAY, marginTop: 2 },
  headerValue: { fontSize: 8, fontWeight: 'bold', color: DARK },
  // Client table
  clientHeader: { backgroundColor: RED, padding: '5 8', marginBottom: 0 },
  clientHeaderText: { color: 'white', fontWeight: 'bold', fontSize: 9, textAlign: 'center' },
  clientTable: { border: `1 solid ${BORDER}`, marginBottom: 10 },
  clientRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  clientCell: { flex: 1, padding: '4 6' },
  clientCellBorder: { flex: 1, padding: '4 6', borderRightWidth: 1, borderRightColor: BORDER },
  cellLabel: { fontSize: 7, color: GRAY, marginBottom: 1 },
  cellValue: { fontSize: 8, fontWeight: 'bold', color: DARK },
  // Total box
  totalBox: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 10, padding: '8 12', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4 },
  totalLabel: { fontSize: 10, fontWeight: 'bold', color: RED },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: RED },
  // Billing
  billingHeader: { backgroundColor: '#374151', padding: '4 8', marginBottom: 0 },
  billingHeaderText: { color: 'white', fontWeight: 'bold', fontSize: 8 },
  billingTable: { border: `1 solid ${BORDER}`, marginBottom: 10 },
  billingNote: { fontSize: 7, color: '#dc2626', marginBottom: 8, padding: '4 8', backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde047' },
  billingRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  billingLabel: { width: 90, padding: '4 6', fontSize: 7, color: GRAY, borderRightWidth: 1, borderRightColor: BORDER },
  billingValue: { flex: 1, padding: '4 6', fontSize: 8 },
  // Policies
  policyHeader: { backgroundColor: '#374151', padding: '4 8', marginBottom: 6 },
  policyHeaderText: { color: 'white', fontWeight: 'bold', fontSize: 8 },
  policyTitle: { fontSize: 8, fontWeight: 'bold', color: DARK, marginBottom: 2, marginTop: 6 },
  policyText: { fontSize: 7.5, color: '#4b5563', marginBottom: 3, lineHeight: 1.5 },
  policyBullet: { fontSize: 7.5, color: '#4b5563', marginBottom: 2, marginLeft: 8, lineHeight: 1.5 },
  // Bank data
  bankBox: { backgroundColor: LIGHTGRAY, padding: '8 10', marginTop: 6, marginBottom: 10, borderRadius: 4 },
  bankTitle: { fontSize: 8, fontWeight: 'bold', color: DARK, marginBottom: 4 },
  bankRow: { flexDirection: 'row', marginBottom: 2 },
  bankLabel: { width: 80, fontSize: 7, color: GRAY },
  bankValue: { fontSize: 7, fontWeight: 'bold', color: DARK },
  // Signature
  signatureBox: { borderTopWidth: 2, borderTopColor: RED, paddingTop: 10, marginTop: 10 },
  signatureRow: { flexDirection: 'row', gap: 20 },
  signatureField: { flex: 1 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: DARK, marginBottom: 3 },
  signatureLabel: { fontSize: 7, color: GRAY },
  commitText: { fontSize: 9, fontWeight: 'bold', color: RED, marginBottom: 8, textAlign: 'center' },
  amountBox: { padding: '6 12', backgroundColor: RED, borderRadius: 4, alignSelf: 'flex-end', marginBottom: 10 },
  amountText: { fontSize: 14, fontWeight: 'bold', color: 'white' },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  footerText: { fontSize: 6.5, color: GRAY },
})

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

const TKS_POLICIES = [
  {
    title: '1. Confirmación de Cotización',
    bullets: [
      'Una vez aceptada la cotización, el cliente deberá confirmarla a través de correo electrónico dirigido a su asesor comercial, adjuntando copia de la cotización debidamente completada a mano.',
      'Este documento constituye la aceptación formal del número de cotización señalado en el encabezado.',
      'Para apoyar la gestión de tráfico, se incluyen espacios en blanco para detallar puntos de salida y destino.',
      '⚠ No se podrán modificar horarios, comunas, regiones o países establecidos en la cotización inicial.',
    ],
  },
  {
    title: '2. Reserva y Pago del Servicio',
    bullets: [
      'Para concluir el proceso de reserva, el cliente deberá enviar copia de la transferencia correspondiente al 50% del valor total del servicio.',
      'El 50% restante deberá ser cancelado antes del inicio del servicio; de lo contrario, la salida no se realizará.',
      'Todos los depósitos deben ser enviados con copia al asesor comercial encargado y a contabilidad@transportestks.com.',
    ],
  },
  {
    title: '3. Carta de Aprobación',
    bullets: [
      'La carta de aprobación debe ser enviada con al menos 24 horas de anticipación.',
      'No se aceptarán cambios con menos de 48 horas de anticipación al inicio del servicio.',
      '⚠ La carta de aprobación valida el servicio, pero no constituye reserva; la reserva es efectiva solo tras el depósito del 50%.',
    ],
  },
  {
    title: '4. Garantía de Servicio',
    bullets: [
      'Al contratar con TKS, el cliente accede a una garantía que cubre:',
      '• Vehículos de contingencia activados en caso de imprevistos.',
      '• Cambio de unidad en caso de no cumplir lo comprometido.',
    ],
  },
  {
    title: '5. Retrasos del Usuario',
    bullets: [
      'Si el usuario retrasa la salida del vehículo más de 30 minutos, se cobrará una hora adicional:',
      '• Van (7 a 19 pasajeros): $15.000 por hora.',
      '• Minibuses y buses (24+ pasajeros): $25.000 por hora.',
      '⚠ Estos montos no aplican a servicios contratados a valor promocional.',
    ],
  },
  {
    title: '6. Suspensión del Servicio',
    bullets: [
      'Suspensión con menos de 48 horas: no se devolverá el abono del 50%.',
      'Suspensión el mismo día: el cliente deberá cancelar el 100% del servicio contratado.',
    ],
  },
  {
    title: '7. Responsabilidad sobre Pertenencias',
    bullets: [
      'Todas las pertenencias y objetos de valor son responsabilidad exclusiva del cliente.',
      'TKS no se hace responsable por pérdidas o daños.',
      'En servicios de ida y retorno, el cliente debe verificar que no queden objetos dentro del vehículo.',
      'El cliente será responsable de cualquier daño ocasionado al vehículo.',
    ],
  },
  {
    title: '8. Observaciones',
    bullets: [
      'El cliente podrá realizar observaciones al momento de la llegada del vehículo.',
      'Una vez iniciado el servicio, no se aceptarán reclamos.',
      'En caso contrario, TKS podrá cobrar el saldo del 50% o el 100% en clientes con crédito.',
    ],
  },
  {
    title: '9. Devoluciones',
    bullets: [
      'No se realizan devoluciones de dinero.',
      'Cualquier saldo a favor de TKS se abonará a un próximo servicio.',
    ],
  },
  {
    title: '10. Prestación de Servicios',
    bullets: [
      'TKS cuenta con vehículos propios y externos de socios estratégicos en contrato, quienes se encuentran alineados a prestar el servicio en las condiciones comprometidas.',
      'En caso de incumplimiento, los socios pueden ser sancionados o suspendidos.',
    ],
  },
  {
    title: '11. Opiniones y Reclamos',
    bullets: [
      'El cliente podrá enviar comentarios a oirs@transportestks.com.',
      'La empresa generará un análisis de gestión y responderá en un plazo máximo de 3 días hábiles.',
    ],
  },
]

export interface TKSQuotationData {
  number: string
  issue_date: string
  expiry_date?: string
  total: number
  subtotal: number
  tax_pct: number
  notes?: string
  client?: { name?: string; rut?: string; email?: string; phone?: string; address?: string }
  vendedor?: { name?: string }
  desde?: string
  hasta?: string
  fecha_salida?: string
  hora_salida?: string
  fecha_retorno?: string
  hora_retorno?: string
  contact_name?: string
  items: { description: string; quantity: number; unit_price: number; subtotal: number }[]
  signed_name?: string
  signed_rut?: string
  signed_at?: string
}

export function TKSQuotationPDF({ data }: { data: TKSQuotationData }) {
  const now = new Date(data.issue_date).toLocaleDateString('es-CL')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Image src={TKS_LOGO} style={{ width: 90, height: 90, objectFit: 'contain' }} />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.cotNum}>{data.number}</Text>
            <Text style={styles.headerLabel}>FECHA CREACIÓN</Text>
            <Text style={styles.headerValue}>{now}</Text>
            <Text style={styles.headerLabel}>COTIZACIÓN</Text>
            <Text style={styles.headerValue}>{data.number}</Text>
            <Text style={styles.headerLabel}>FECHA COTIZACIÓN</Text>
            <Text style={styles.headerValue}>{now}</Text>
          </View>
        </View>

        {/* Client section */}
        <View style={styles.clientHeader}>
          <Text style={styles.clientHeaderText}>CLIENTE</Text>
        </View>
        <View style={styles.clientTable}>
          <View style={styles.clientRow}>
            <View style={styles.clientCellBorder}>
              <Text style={styles.cellLabel}>EMPRESA</Text>
              <Text style={styles.cellValue}>{data.client?.name ?? '—'}</Text>
            </View>
            <View style={styles.clientCell}>
              <Text style={styles.cellLabel}>DESDE</Text>
              <Text style={styles.cellValue}>{data.desde ?? '—'}</Text>
            </View>
          </View>
          <View style={[styles.clientRow, { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
            <View style={styles.clientCellBorder}>
              <Text style={styles.cellLabel}>RUT</Text>
              <Text style={styles.cellValue}>{data.client?.rut ?? '—'}</Text>
            </View>
            <View style={styles.clientCell}>
              <Text style={styles.cellLabel}>HASTA</Text>
              <Text style={styles.cellValue}>{data.hasta ?? '—'}</Text>
            </View>
          </View>
          <View style={[styles.clientRow, { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
            <View style={styles.clientCellBorder}>
              <Text style={styles.cellLabel}>CONTACTO</Text>
              <Text style={styles.cellValue}>{data.contact_name ?? data.client?.name ?? '—'}</Text>
            </View>
            <View style={[styles.clientCell, { flexDirection: 'row', gap: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cellLabel}>FECHA SALIDA</Text>
                <Text style={styles.cellValue}>{data.fecha_salida ?? '—'}</Text>
              </View>
              <View style={{ width: 50 }}>
                <Text style={styles.cellLabel}>HORA</Text>
                <Text style={styles.cellValue}>{data.hora_salida ?? '—'}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.clientRow, { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
            <View style={styles.clientCellBorder}>
              <Text style={styles.cellLabel}>TELÉFONO</Text>
              <Text style={styles.cellValue}>{data.client?.phone ?? '—'}</Text>
            </View>
            <View style={[styles.clientCell, { flexDirection: 'row', gap: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cellLabel}>FECHA RETORNO</Text>
                <Text style={styles.cellValue}>{data.fecha_retorno ?? '—'}</Text>
              </View>
              <View style={{ width: 50 }}>
                <Text style={styles.cellLabel}>HORA</Text>
                <Text style={styles.cellValue}>{data.hora_retorno ?? '—'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.clientRow}>
            <View style={styles.clientCellBorder}>
              <Text style={styles.cellLabel}>MAIL</Text>
              <Text style={styles.cellValue}>{data.client?.email ?? '—'}</Text>
            </View>
            <View style={styles.clientCell}>
              <Text style={styles.cellLabel}>VENDEDOR</Text>
              <Text style={styles.cellValue}>{data.vendedor?.name ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Billing section */}
        <View style={styles.billingHeader}>
          <Text style={styles.billingHeaderText}>FACTURAR ESTE SERVICIO A:</Text>
        </View>
        <Text style={styles.billingNote}>
          POR LEGISLACIÓN CHILENA NO PODEMOS EMITIR NINGUNA FACTURA SI UD. NO PRESENTA EL E-RUT DE EMPRESA O PERSONA NATURAL. RECORDAMOS QUE PARA SOLICITAR ESTE DOCUMENTO TAMBIÉN DEBE TENER PAGADO EL 100% DEL SERVICIO.
        </Text>
        <View style={styles.billingTable}>
          {['NOMBRE', 'RUT', 'DIRECCIÓN', 'EMPRESA', 'GLOSA DE FACTURA'].map(field => (
            <View key={field} style={[styles.billingRow, { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
              <Text style={styles.billingLabel}>{field}</Text>
              <Text style={styles.billingValue}> </Text>
            </View>
          ))}
        </View>

        {/* Policies */}
        <View style={styles.policyHeader}>
          <Text style={styles.policyHeaderText}>POLÍTICAS</Text>
        </View>
        {TKS_POLICIES.map(p => (
          <View key={p.title}>
            <Text style={styles.policyTitle}>{p.title}</Text>
            {p.bullets.map((b, i) => (
              <Text key={i} style={styles.policyBullet}>• {b}</Text>
            ))}
          </View>
        ))}

        {/* Bank data */}
        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>Datos de transferencia para reserva (50%):</Text>
          {[
            ['Tipo de cuenta', 'Cta. Cte.'],
            ['Banco', 'Banco de Crédito e Inversiones (BCI)'],
            ['Swift', 'CREDCLRM'],
            ['Nombre', 'Claudio Chuhaicura López'],
            ['RUT', '14.395.747-0'],
            ['Cta. Corriente', '27975631'],
            ['Email contabilidad', 'contabilidad@transportestks.com'],
          ].map(([label, value]) => (
            <View key={label} style={styles.bankRow}>
              <Text style={styles.bankLabel}>{label}:</Text>
              <Text style={styles.bankValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Total + Signature */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <View style={styles.amountBox}>
            <Text style={[styles.amountText, { fontSize: 9, marginBottom: 2 }]}>ME COMPROMETO A CANCELAR EL SIGUIENTE MONTO</Text>
            <Text style={styles.amountText}>{formatCLP(data.total)}</Text>
          </View>
        </View>

        <View style={styles.signatureBox}>
          {data.signed_at ? (
            <View style={{ backgroundColor: '#f0fdf4', padding: 10, borderRadius: 4, borderWidth: 1, borderColor: '#86efac' }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>DOCUMENTO FIRMADO DIGITALMENTE — Ley 19.799</Text>
              <Text style={{ fontSize: 8, color: '#374151' }}>Nombre: {data.signed_name}</Text>
              <Text style={{ fontSize: 8, color: '#374151' }}>RUT: {data.signed_rut}</Text>
              <Text style={{ fontSize: 8, color: '#374151' }}>Fecha: {new Date(data.signed_at).toLocaleString('es-CL')}</Text>
            </View>
          ) : (
            <View style={styles.signatureRow}>
              <View style={styles.signatureField}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>NOMBRE REPRESENTANTE</Text>
              </View>
              <View style={styles.signatureField}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>RUT</Text>
              </View>
              <View style={styles.signatureField}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>FIRMA Y TIMBRE</Text>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Transportes TKS SpA · {data.number} · oirs@transportestks.com</Text>
        </View>
      </Page>
    </Document>
  )
}
