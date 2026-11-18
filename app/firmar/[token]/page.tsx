export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SigningForm from './SigningForm'
import PrintCloseButtons from './PrintCloseButtons'

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
    // position:fixed + overflow-y:auto resuelve el overflow:hidden global del dashboard
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#eef2f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`@media print { .no-print { display: none !important; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }`}</style>
      {/* Header branded TransCCL */}
      <div style={{ background: '#ffffff', borderBottom: '4px solid #e52832', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-transccl.png" alt="TransCCL" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right', marginRight: 16 }}>
          <div style={{ fontSize: 12, color: '#52637c', fontWeight: 500 }}>Carta de Aprobación y Aceptación del Servicio</div>
          {quoteNum ? <div style={{ fontSize: 15, color: '#082e62', fontWeight: 800, marginTop: 3 }}>N° {quoteNum}</div> : null}
        </div>
        <PrintCloseButtons />
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
