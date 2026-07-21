import { getSession, fetchActivitiesAll, fetchProfiles } from '@/lib/api'
import AgendaView from '@/components/agenda/AgendaView'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tipo?: string; vendedor?: string }>
}) {
  const { filter = 'pendientes', tipo, vendedor } = await searchParams
  const user = await getSession()
  const isAdmin = user?.role === 'admin'

  const params: Record<string, string> = { filter }
  if (tipo) params.tipo = tipo
  if (vendedor && isAdmin) params.vendedor = vendedor

  const [activities, sellers] = await Promise.all([
    fetchActivitiesAll(params),
    isAdmin ? fetchProfiles() : Promise.resolve([]),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestiones y actividades de todos los negocios</p>
      </div>
      <AgendaView
        activities={activities}
        sellers={sellers}
        currentFilter={filter}
        currentTipo={tipo}
        currentVendedor={vendedor}
        isAdmin={isAdmin}
        userId={user?.id ?? ''}
      />
    </div>
  )
}
