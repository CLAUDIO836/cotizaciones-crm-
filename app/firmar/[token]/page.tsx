export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SigningForm from './SigningForm'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

async function getLetter(token: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${CRM_API}?action=letters_get&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as Record<string, string>) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const letter = await getLetter(token)
  const num = letter?.quotation_number ?? letter?.pipedrive_deal_id ?? ''
  return { title: num ? `Carta de Aprobación N° ${num} — TransCCL` : 'Carta de Aprobación — TransCCL' }
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const letter = await getLetter(token)
  if (!letter) notFound()

  const quoteNum = letter.quotation_number ?? letter.pipedrive_deal_id ?? ''

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header branded TransCCL */}
      <div style={{ background: '#082e62', borderBottom: '4px solid #e52832', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1 }}>
            Trans<span style={{ color: '#7fc76a' }}>ccl</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3, letterSpacing: '0.03em' }}>
            Transportes de Pasajeros
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>Carta de Aprobación y Aceptación del Servicio</div>
          {quoteNum ? <div style={{ fontSize: 14, color: 'white', fontWeight: 700, marginTop: 3 }}>N° {quoteNum}</div> : null}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 16px 48px' }}>
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
