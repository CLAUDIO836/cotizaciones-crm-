import { getSession, fetchQuotationsSummary, fetchPipelines, fetchCompanies, fetchProfiles } from '@/lib/api'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import QuotationsList from '@/components/quotations/QuotationsList'
import EtapaKanban from '@/components/quotations/EtapaKanban'
import TimelineView from '@/components/quotations/TimelineView'
import PipelineFilter from '@/components/quotations/PipelineFilter'

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    month?: string
    vendedor?: string
    pipeline?: string
    company?: string
    q?: string
    view?: string
  }>
}) {
  const params = await searchParams
  const user = await getSession()
  const isAdmin = user?.role === 'admin'
  const isReadOnly = user?.role === 'coordinador'
  const view = params.view ?? 'timeline'

  const qFilters: Record<string, string> = {}
  if (params.status)   qFilters.status   = params.status
  if (params.vendedor && isAdmin) qFilters.vendedor = params.vendedor
  if (params.pipeline) qFilters.pipeline = params.pipeline
  if (params.company)  qFilters.company  = params.company
  if (params.q)        qFilters.q        = params.q
  if (params.month) {
    const [y, m] = params.month.split('-')
    qFilters.year = y; qFilters.month = m
  }

  const [quotations, pipelines, companies, vendedores] = await Promise.all([
    fetchQuotationsSummary(qFilters),
    fetchPipelines(),
    fetchCompanies(),
    isAdmin ? fetchProfiles() : Promise.resolve([]),
  ])

  // Totales para mostrar en los filtros
  const total = quotations.length
  const won = quotations.filter(q => q.status === 'won').length
  const open = quotations.filter(q => q.status === 'open').length
  const lost = quotations.filter(q => q.status === 'lost').length

  const views = [
    { key: 'timeline', label: 'Por mes' },
    { key: 'kanban', label: 'Pipeline' },
    { key: 'list', label: 'Lista' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top bar — estilo PipeDrive */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">Negocios</h1>
          <span className="text-xs text-gray-400 font-medium">
            {total} total · {open} abiertas · {won} ganadas · {lost} perdidas
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Vista toggle */}
          <div className="flex rounded-lg border bg-gray-50 overflow-hidden p-0.5 gap-0.5">
            {views.map(v => {
              const nextParams = new URLSearchParams(
                Object.entries({ ...params, view: v.key })
                  .filter(([, val]) => Boolean(val)) as [string, string][]
              )
              return (
                <Link key={v.key} href={`/cotizaciones?${nextParams.toString()}`}
                  className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                  style={view === v.key
                    ? { background: 'white', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#6b7280' }
                  }
                >
                  {v.label}
                </Link>
              )
            })}
          </div>

          {!isReadOnly && (
            <Link href="/cotizaciones/nueva">
              <Button style={{ background: '#1B8A4B', border: 'none' }} className="text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                Negocio
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar — embudos y vendedores */}
      <PipelineFilter
        pipelines={pipelines}
        vendedores={isAdmin ? vendedores : []}
        companies={companies}
        currentPipeline={params.pipeline}
        currentVendedor={params.vendedor}
        currentCompany={params.company}
        currentParams={params}
        isAdmin={isAdmin}
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {view === 'timeline' && (
          <TimelineView quotations={quotations} isAdmin={isAdmin} />
        )}
        {view === 'kanban' && (
          <EtapaKanban quotations={quotations} isAdmin={isAdmin} />
        )}
        {view === 'list' && (
          <QuotationsList
            quotations={quotations}
            vendedores={vendedores}
            isAdmin={isAdmin}
            currentFilters={params}
          />
        )}
      </div>
    </div>
  )
}
