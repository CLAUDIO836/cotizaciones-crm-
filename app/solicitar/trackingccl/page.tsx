import LeadRequestForm from '@/components/public/LeadRequestForm'

export const metadata = { title: 'Cotiza tu servicio · TrackingCCL' }

export default function SolicitarTrackingCCL() {
  return (
    <LeadRequestForm company={{
      key: 'trackingccl',
      name: 'TrackingCCL',
      tagline: 'Soluciones de GPS y seguimiento de flotas',
      color: '#0ea5e9',
      logoText: 'G',
      email: 'ventas@trackingccl.cl',
    }} />
  )
}
