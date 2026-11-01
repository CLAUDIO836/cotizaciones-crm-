import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api'
import Bandeja from '@/components/autorizaciones/Bandeja'

export default async function AutorizacionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">Por aprobar</h1>
      <p className="text-sm text-gray-500 mb-6">
        Descuentos bajo el mínimo y recargos pedidos desde el Cotizador. Basta con que apruebe una persona: Claudio, Claudia o Paola.
      </p>
      <Bandeja miId={session.id} />
    </div>
  )
}
