import {
  Document, Page, Text, View, StyleSheet, Font
} from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  fonts: [],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  company: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8' },
  companyInfo: { fontSize: 9, color: '#6b7280', marginTop: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  number: { fontSize: 11, color: '#6b7280' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' },
  clientName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { color: '#6b7280', width: 80 },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: '8 4',
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: { flexDirection: 'row', padding: '6 4', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colDesc: { flex: 1 },
  colQty: { width: 60, textAlign: 'center' },
  colPrice: { width: 80, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  headerText: { fontSize: 9, fontWeight: 'bold', color: '#374151' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  totalsLabel: { width: 100, textAlign: 'right', color: '#6b7280', marginRight: 8 },
  totalsValue: { width: 80, textAlign: 'right' },
  totalsFinal: { fontWeight: 'bold', fontSize: 12, color: '#111827' },
  footer: { marginTop: 30, padding: '10 0', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerText: { fontSize: 8, color: '#9ca3af' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 9,
    fontWeight: 'bold',
  },
})

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('es-CL').format(new Date(d))
}

interface QuotationPDFData {
  number: string
  status: string
  issue_date: string
  expiry_date?: string
  subtotal: number
  tax_pct: number
  total: number
  notes?: string
  terms?: string
  client?: { name: string; rut?: string; email?: string; address?: string }
  vendedor?: { name: string }
  items: { description: string; quantity: number; unit_price: number; subtotal: number }[]
}

export function QuotationPDF({ data }: { data: QuotationPDFData }) {
  const taxAmount = data.subtotal * (data.tax_pct / 100)
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Mi Empresa'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{companyName}</Text>
            <Text style={styles.companyInfo}>{process.env.NEXT_PUBLIC_COMPANY_RUT ?? ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>COTIZACIÓN</Text>
            <Text style={styles.number}>{data.number}</Text>
            <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>
              Emisión: {formatDate(data.issue_date)}
            </Text>
            {data.expiry_date && (
              <Text style={{ fontSize: 9, color: '#6b7280' }}>
                Vence: {formatDate(data.expiry_date)}
              </Text>
            )}
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <Text style={styles.clientName}>{data.client?.name ?? '—'}</Text>
          {data.client?.rut && (
            <View style={styles.row}>
              <Text style={styles.label}>RUT:</Text>
              <Text>{data.client.rut}</Text>
            </View>
          )}
          {data.client?.email && (
            <View style={styles.row}>
              <Text style={styles.label}>Email:</Text>
              <Text>{data.client.email}</Text>
            </View>
          )}
          {data.client?.address && (
            <View style={styles.row}>
              <Text style={styles.label}>Dirección:</Text>
              <Text>{data.client.address}</Text>
            </View>
          )}
        </View>

        {/* Ítems */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Productos / Servicios</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.headerText, styles.colQty]}>Cant.</Text>
            <Text style={[styles.headerText, styles.colPrice]}>P. Unit.</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Subtotal</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatCLP(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{formatCLP(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totales */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCLP(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>IVA ({data.tax_pct}%)</Text>
            <Text style={styles.totalsValue}>{formatCLP(taxAmount)}</Text>
          </View>
          <View style={[styles.totalsRow, { marginTop: 4 }]}>
            <Text style={[styles.totalsLabel, styles.totalsFinal]}>TOTAL</Text>
            <Text style={[styles.totalsValue, styles.totalsFinal]}>{formatCLP(data.total)}</Text>
          </View>
        </View>

        {/* Notas y términos */}
        {(data.notes || data.terms) && (
          <View style={{ marginTop: 24, flexDirection: 'row', gap: 16 }}>
            {data.notes && (
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Notas</Text>
                <Text style={{ color: '#4b5563', lineHeight: 1.5 }}>{data.notes}</Text>
              </View>
            )}
            {data.terms && (
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Términos y condiciones</Text>
                <Text style={{ color: '#4b5563', lineHeight: 1.5 }}>{data.terms}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { position: 'absolute', bottom: 30, left: 40, right: 40 }]}>
          <Text style={styles.footerText}>
            {companyName} · Cotización {data.number} · Emitida el {formatDate(data.issue_date)}
            {data.vendedor?.name ? ` · Vendedor: ${data.vendedor.name}` : ''}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
