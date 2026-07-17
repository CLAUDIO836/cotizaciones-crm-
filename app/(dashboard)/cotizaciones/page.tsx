import { createClient } from '@/lib/supabase/server'
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
    q?: string
    view?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isReadOnly = profile?.role === 'coordinador'
  const isOwn = !isAdmin  // vendedor / ejecutivo / coordinador solo ven lo suyo
  const view = params.view ?? 'timeline'

  let query = supabase
    .from('quotations_summary')
    .select('*')
    .order('created_at', { ascending: false })

  if (isOwn) query = query.eq('vendedor_id', user!.id)
  if (params.status) query = query.eq('status', params.status)
  if (params.vendedor) query = query.eq('vendedor_id', params.vendedor)
  if (params.pipeline) query = query.eq('pipeline_id', params.pipeline)
  if (params.month) {
    const [y, m] = params.month.split('-')
    query = query.eq('year', parseInt(y)).eq('month', parseInt(m))
  }
  if (params.q) {
    query = query.or(`number.ilike.%${params.q}%,client_name.ilike.%${params.q}%`)
  }

  const { data: quotations = [] } = await query
  const { data: pipelines = [] } = await supabase
    .from('pipelines').select('id, name, color').eq('active', true).order('sort_order')
  const { data: vendedores = [] } = isAdmin
    ? await supabase.from('profiles').select('id, name').order('name')
    : { data: [] }

  // Totales para mostrar en los filtros
  const total = quotations?.length ?? 0
  const won = quotations?.filter(q => q.status === 'won').length ?? 0
  const open = quotations?.filter(q => q.status === 'open').length ?? 0
  const lost = quotations?.filter(q => q.status === 'lost').length ?? 0

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
        pipelines={pipelines ?? []}
        vendedores={isAdmin ? (vendedores ?? []) : []}
        currentPipeline={params.pipeline}
        currentVendedor={params.vendedor}
        currentParams={params}
        isAdmin={isAdmin}
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {view === 'timeline' && (
          <TimelineView quotations={quotations ?? []} isAdmin={isAdmin} />
        )}
        {view === 'kanban' && (
          <EtapaKanban quotations={quotations ?? []} isAdmin={isAdmin} />
        )}
        {view === 'list' && (
          <QuotationsList
            quotations={quotations ?? []}
            vendedores={vendedores ?? []}
            isAdmin={isAdmin}
            currentFilters={params}
          />
        )}
      </div>
    </div>
  )
}
