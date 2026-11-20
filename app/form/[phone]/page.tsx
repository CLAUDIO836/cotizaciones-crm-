'use client'
import { useParams } from 'next/navigation'
import UnifiedLeadForm from '@/components/public/UnifiedLeadForm'

export default function FormPage() {
  const params   = useParams()
  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone
  const phone    = rawPhone?.replace(/\D/g, '') ?? ''

  if (!phone) return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#e53e3e', fontSize: 14 }}>Link inválido. Por favor contacta a TransCCL directamente.</div>
    </div>
  )

  return (
    <UnifiedLeadForm
      phone={phone}
      company={{ key: 'transccl', name: 'Transportes Transccl SpA', color: '#1B8A4B' }}
    />
  )
}
