import { fetchLeads, fetchProfiles, fetchWaSolicitudes } from '@/lib/api'
import SolicitudesTabs from '@/components/leads/SolicitudesTabs'

export const dynamic = 'force-dynamic'

export default async function SolicitudesPage() {
  const [leads, sellers, waConvs] = await Promise.all([
    fetchLeads(),
    fetchProfiles(),
    fetchWaSolicitudes(),
  ])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de cotización</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leads entrantes desde formularios públicos y WhatsApp</p>
        </div>
        <div className="flex gap-2 text-xs">
          {(['transccl','tks','trackingccl'] as const).map(k => (
            <a key={k} href={`/solicitar/${k}`} target="_blank"
              className="px-3 py-1.5 rounded-lg border text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-all">
              Ver form {k}
            </a>
          ))}
        </div>
      </div>

      <SolicitudesTabs
        leads={leads ?? []}
        sellers={sellers ?? []}
        waConvs={waConvs ?? []}
      />
    </div>
  )
}
