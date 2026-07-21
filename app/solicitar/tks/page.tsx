import LeadRequestForm from '@/components/public/LeadRequestForm'

export const metadata = { title: 'Cotiza tu servicio · Transportes TKS' }

export default function SolicitarTKS() {
  return (
    <LeadRequestForm company={{
      key: 'tks',
      name: 'Transportes TKS',
      tagline: 'Traslado diario, educativo y viajes especiales',
      color: '#C8102E',
      logoText: 'K',
      email: 'ventas@transportestks.com',
    }} />
  )
}
