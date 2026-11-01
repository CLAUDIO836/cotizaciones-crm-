import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api'
import Cotizador from '@/components/cotizador/Cotizador'

export default async function CotizadorPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">Cotizador</h1>
      <p className="text-sm text-gray-500 mb-6">
        Precio según el tarifario TransCCL. Valores exentos de IVA, conductor incluido, peajes aparte.
      </p>
      <Cotizador />
    </div>
  )
}
