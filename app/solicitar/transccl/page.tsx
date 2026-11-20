import UnifiedLeadForm from '@/components/public/UnifiedLeadForm'

export const metadata = { title: 'Cotiza tu servicio · Transportes Transccl' }

export default function SolicitarTransccl() {
  return (
    <UnifiedLeadForm company={{ key: 'transccl', name: 'Transportes Transccl SpA', color: '#1B8A4B' }} />
  )
}
