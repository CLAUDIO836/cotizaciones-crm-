import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import SigningForm from './SigningForm'

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

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = getAdminClient()

  const { data: letter } = await admin
    .from('approval_letters')
    .select('*')
    .eq('token', token)
    .single()

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
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        {letter.signed_at ? (
          <AlreadySigned letter={letter} />
        ) : (
          <SigningForm letter={letter} />
        )}
      </div>
    </div>
  )
}

function AlreadySigned({ letter }: { letter: Record<string, string> }) {
  return (
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
  )
}
