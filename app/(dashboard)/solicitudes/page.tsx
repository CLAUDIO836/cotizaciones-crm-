import { fetchLeads, fetchProfiles } from '@/lib/api'
import LeadRequestsPanel from '@/components/leads/LeadRequestsPanel'

export default async function SolicitudesPage() {
  const [leads, sellers] = await Promise.all([fetchLeads(), fetchProfiles()])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de cotización</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leads entrantes desde formularios públicos</p>
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

      <LeadRequestsPanel leads={leads ?? []} sellers={sellers ?? []} />
    </div>
  )
}
