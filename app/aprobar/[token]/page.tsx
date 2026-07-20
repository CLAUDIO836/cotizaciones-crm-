import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ApprovalForm from './ApprovalForm'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

export default async function AprobarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = getAdminClient()

  const { data: approval } = await admin
    .from('quotation_approvals')
    .select('*')
    .eq('token', token)
    .single()

  if (!approval) notFound()

  const items: { description: string; quantity: number; unit_price: number; subtotal: number }[] = approval.items ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#16192A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1B8A4B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>T</span>
        </div>
        <div>
          <p style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: 14 }}>{approval.company_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 11 }}>Aprobación de Cotización</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Ya respondida */}
        {approval.response && (
          <AlreadyResponded approval={approval} />
        )}

        {!approval.response && (
          <>
            {/* Datos del servicio */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Detalle del Servicio</h2>
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
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Total del servicio</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{formatCLP(Number(approval.total))}</span>
                </div>
              )}
            </div>

            {/* Ítems */}
            {items.length > 0 && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Detalle de ítems</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 50 }}>Cant.</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 110 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 10px', color: '#111827' }}>{item.description}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#6b7280' }}>{item.quantity}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{formatCLP(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulario de respuesta */}
            <ApprovalForm token={token} quotationId={approval.quotation_id} />
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

function AlreadyResponded({ approval }: { approval: Record<string, string> }) {
  const accepted = approval.response === 'accepted'
  return (
    <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${accepted ? '#86efac' : '#fca5a5'}`, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: accepted ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        {accepted
          ? <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
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
