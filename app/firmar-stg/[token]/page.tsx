export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import SigningFormStg from './SigningFormStg'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')

async function getLetter(token: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${CRM_API_STG}?action=letters_get&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as Record<string, string>) ?? null
  } catch {
    return null
  }
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

export default async function SignStagingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const letter = await getLetter(token)
  if (!letter) notFound()

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#16192A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1B8A4B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>T</span>
        </div>
        <div>
          <p style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: 14 }}>{letter.company_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 11 }}>Carta de Aprobación de Servicio</p>
        </div>
        <div style={{ marginLeft: 'auto', background: '#fbbf24', color: '#78350f', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
          PRUEBA STAGING
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        {letter.signed_at ? (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Documento ya firmado</h2>
            <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 14 }}>Firmado por: <strong>{letter.signed_name}</strong></p>
            <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
              {new Date(letter.signed_at).toLocaleString('es-CL')}
            </p>
          </div>
        ) : (
          <SigningFormStg letter={letter} token={token} />
        )}

        {/* Totales */}
        {letter.total && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Valor total del servicio</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{formatCLP(Number(letter.total))}</span>
          </div>
        )}
      </div>
    </div>
  )
}
