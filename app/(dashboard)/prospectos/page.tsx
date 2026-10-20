export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { fetchCampaigns } from '@/lib/prospectos-api'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import CampaignsList from '@/components/prospectos/CampaignsList'

export default async function ProspectosPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const campaigns = await fetchCampaigns()
  const isAdmin = user.role === 'admin'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Motor de Prospección</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona tus bases de datos de prospectos por campaña</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/prospectos/admin"
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              ⚙ Asignación de comunas
            </Link>
          )}
          {isAdmin && (
            <button
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
              style={{ background: '#1B8A4B' }}>
              + Nueva Campaña
            </button>
          )}
        </div>
      </div>

      <CampaignsList campaigns={campaigns} isAdmin={isAdmin} />
    </div>
  )
}
