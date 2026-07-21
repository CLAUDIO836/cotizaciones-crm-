import LeadRequestForm from '@/components/public/LeadRequestForm'

export const metadata = { title: 'Cotiza tu servicio · Transportes Transccl' }

export default function SolicitarTransccl() {
  return (
    <LeadRequestForm company={{
      key: 'transccl',
      name: 'Transportes Transccl SpA',
      tagline: 'Traslado diario, educativo y viajes especiales',
      color: '#1B8A4B',
      logoText: 'T',
      email: 'ventas@transccl.cl',
    }} />
  )
}
