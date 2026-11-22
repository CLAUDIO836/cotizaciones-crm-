import { fetchLeads, fetchProfiles, fetchBwaPending } from '@/lib/api'
import LeadRequestsPanel from '@/components/leads/LeadRequestsPanel'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SolicitudesPage() {
  const [leads, sellers, bwaPending] = await Promise.all([
    fetchLeads(),
    fetchProfiles(),
    fetchBwaPending(),
  ])

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

      {/* Sección: WA sin cliente */}
      {bwaPending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-semibold text-gray-700">
              Desde WhatsApp — sin cliente registrado ({bwaPending.length})
            </h2>
          </div>
          <div className="space-y-2">
            {bwaPending.map(bwa => (
              <Link key={bwa.id} href={`/cotizaciones/${bwa.id}`}
                className="block bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 hover:bg-amber-100 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-700">#{bwa.number}</span>
                    {bwa.desde && bwa.hasta && (
                      <span className="text-xs text-gray-600 truncate max-w-xs">
                        {bwa.desde} → {bwa.hasta}
                      </span>
                    )}
                    {bwa.distancia_km ? (
                      <span className="text-xs text-gray-400">{bwa.distancia_km} km</span>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(bwa.created_at).toLocaleDateString('es-CL')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <LeadRequestsPanel leads={leads ?? []} sellers={sellers ?? []} />
    </div>
  )
}
