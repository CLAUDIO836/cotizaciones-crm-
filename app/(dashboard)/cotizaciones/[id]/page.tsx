export const dynamic = 'force-dynamic'
import { getSession, fetchQuotation, fetchActivities, fetchNotes, fetchPipelines } from '@/lib/api'
import AutoRefresh from '@/components/AutoRefresh'
import { notFound } from 'next/navigation'
import { formatCLP, formatDate, getStatusLabel } from '@/lib/utils'
import StatusActions from '@/components/quotations/StatusActions'
import ActivitiesPanel from '@/components/quotations/ActivitiesPanel'
import NotesPanel from '@/components/quotations/NotesPanel'
import QuotationTabs from '@/components/quotations/QuotationTabs'
import Link from 'next/link'
import { ArrowLeft, Edit, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/quotations/DeleteButton'
import ApprovalLetterButton from '@/components/quotations/ApprovalLetterButton'
import QuotationApprovalButton from '@/components/quotations/QuotationApprovalButton'
import ResyncButton from '@/components/quotations/ResyncButton'
import DocumentsTab from '@/components/quotations/DocumentsTab'

const ETAPA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  lead:        { label: 'Lead',        color: '#6366f1', bg: '#eef2ff' },
  contactado:  { label: 'Contactado',  color: '#0ea5e9', bg: '#f0f9ff' },
  cotizacion:  { label: 'Cotización',  color: '#F2B705', bg: '#fffbeb' },
  negociacion: { label: 'Negociación', color: '#f97316', bg: '#fff7ed' },
  cierre:      { label: 'Cierre',      color: '#1B8A4B', bg: '#f0fdf4' },
}

export default async function CotizacionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'datos' } = await searchParams
  const user = await getSession()
  const isReadOnly = user?.role === 'coordinador'

  const [q, activities, notes, pipelines] = await Promise.all([
    fetchQuotation(id),
    fetchActivities(id),
    fetchNotes(id),
    fetchPipelines(),
  ])

  if (!q) notFound()

  const pipeline = pipelines.find(p => p.id === q.pipeline_id) ?? null
  const items = q.quotation_items ?? []
  const { label, color } = getStatusLabel(q.status)
  const etapa = ETAPA_LABELS[q.etapa ?? 'lead'] ?? ETAPA_LABELS.lead
  const qAny = q as unknown as Record<string, unknown>
  const companyStr = ((qAny.company ?? qAny.company_real_name ?? qAny.pipeline_name ?? '') as string).toUpperCase()
  const isTKS      = companyStr.includes('TKS')
  const isTracking = companyStr.includes('TRACKING')
  const brandBadge = isTKS
    ? { label: 'TKS',      bg: '#fef2f2', color: '#C8102E' }
    : isTracking
      ? { label: 'TRACKING', bg: '#eff6ff', color: '#1d4ed8' }
      : { label: 'CCL',      bg: '#f0fdf4', color: '#1B8A4B' }
  const activitiesWithName = activities
  const notesWithName = notes

  return (
    <div className="flex flex-col h-full">
      <AutoRefresh intervalMs={5000} />
      {/* Header — 2 filas */}
      <div className="bg-white border-b px-6 pt-2 pb-2 space-y-1.5">
        {/* Fila 1: ← título + Ganado/Perdido */}
        <div className="flex items-center gap-3">
          <Link href="/cotizaciones" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {/* Título compacto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
              <span className="text-base font-bold text-gray-900 flex-shrink-0">#{q.number}</span>
              <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: color.includes('green') ? '#dcfce7' : color.includes('red') ? '#fee2e2' : '#dbeafe', color: color.includes('green') ? '#16a34a' : color.includes('red') ? '#D33A2C' : '#2563eb' }}>
                {label}
              </span>
              <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: etapa.bg, color: etapa.color }}>{etapa.label}</span>
              <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-bold flex-shrink-0"
                style={{ background: brandBadge.bg, color: brandBadge.color }}>{brandBadge.label}</span>
              {(pipeline?.name ?? q.pipeline_name) && (
                <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-semibold flex-shrink-0"
                  style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pipeline?.name ?? q.pipeline_name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 leading-tight truncate">
              {q.clients?.name}{q.issue_date && ` · ${formatDate(q.issue_date)}`}{q.profiles?.name && ` · ${q.profiles.name}`}
            </p>
          </div>
          {/* Ganado / Perdido — prominentes, ~10cm = 190px c/u */}
          {!isReadOnly && (
            <div className="flex gap-2 flex-shrink-0">
              <StatusActions quotationId={q.id} quotationNumber={q.number} clientId={q.client_id ?? ''} userId={q.user_id ?? ''} total={q.total} status={q.status} pipedriveDealId={q.pipedrive_deal_id} inline btnWidth={190} />
            </div>
          )}
        </div>

        {/* Fila 2: botones de acción — max ~5cm = 190px c/u */}
        <div className="flex items-center gap-1.5 flex-wrap pl-8">
          <a href={`/api/cotizaciones/${id}/html`} target="_blank">
            <Button variant="outline" size="sm" style={{ maxWidth: 190, fontSize: 12 }}>
              <Globe className="w-3.5 h-3.5 mr-1" />
              Ver / Imprimir
            </Button>
          </a>
          {!isTracking && (
            <>
              <a href={`/api/cotizaciones/${id}/propuesta`} target="_blank">
                <Button variant="outline" size="sm" style={{ maxWidth: 190, fontSize: 12, borderColor: '#1B8A4B', color: '#1B8A4B' }}>
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  Propuesta
                </Button>
              </a>
              <a href={`/api/cotizaciones/${id}/propuesta/download`} download>
                <Button variant="outline" size="sm" style={{ maxWidth: 190, fontSize: 12, borderColor: '#1B8A4B', color: '#1B8A4B' }}>
                  ⬇ Descargar PDF
                </Button>
              </a>
            </>
          )}
          {!isReadOnly && (
            <ResyncButton
              quotationId={id}
              pipedriveDealId={q.pipedrive_deal_id}
              pipelineId={q.pipeline_id ?? undefined}
              fechaSalida={(q as { fecha_salida?: string }).fecha_salida}
              companyName={(q as unknown as { companies?: { name?: string }; company?: string }).companies?.name ?? (q as { company?: string }).company}
              desde={(q as { desde?: string }).desde}
              hasta={(q as { hasta?: string }).hasta}
            />
          )}
          {!isReadOnly && (
            <Link href={`/cotizaciones/${id}/editar`}>
              <Button variant="outline" size="sm" style={{ maxWidth: 190, fontSize: 12 }}>
                <Edit className="w-3.5 h-3.5 mr-1" />
                Editar
              </Button>
            </Link>
          )}
          {!isReadOnly && (
            <DeleteButton quotationId={id} pipedriveDealId={q.pipedrive_deal_id} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <QuotationTabs
        quotationId={id}
        currentTab={tab}
        activitiesCount={activitiesWithName.length}
        notesCount={notesWithName.length}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'datos' && (
          <div className="max-w-2xl space-y-5">

            {/* Resumen ejecutivo — se adapta según embudo */}
            {(() => {
              const pipelineName = (pipeline?.name ?? q.pipeline_name ?? '').toLowerCase()
              const isDiario = pipelineName.includes('diario')

              // Parsear items diario
              type DiarioItem = { ruta: string; desde: string; hasta: string; hora_salida: string; hora_retorno: string; tiene_paradas: boolean; obs_paradas: string }
              const diarioItems: DiarioItem[] = []
              for (const it of items as { description?: string; pasajeros?: number; quantity?: number; unit_price?: number; codigo?: string }[]) {
                try {
                  const p = JSON.parse(it.description ?? '')
                  if (p?.__diario) diarioItems.push(p as DiarioItem)
                } catch { /* no es json */ }
              }

              if (isDiario && diarioItems.length > 0) {
                // ── TRASLADO DIARIO ──
                const totalMensual = (items as { quantity?: number; unit_price?: number }[]).reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0), 0)
                return (
                  <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#1B8A4B' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#1B8A4B' }}>
                      <span className="text-white text-xs font-bold uppercase tracking-widest">Traslado Diario · {diarioItems.length} {diarioItems.length === 1 ? 'ruta' : 'rutas'}</span>
                      <span className="ml-auto text-white text-sm font-bold">{formatCLP(totalMensual)}<span className="font-normal text-green-200 text-xs">/mes</span></span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {diarioItems.map((d, i) => (
                        <div key={i} className="px-4 py-3 bg-white">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900">{d.ruta || `Ruta ${i + 1}`}</span>
                            {(d.hora_salida || d.hora_retorno) && (
                              <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1B8A4B' }}>
                                {d.hora_salida && `↑ ${d.hora_salida}`}{d.hora_retorno && ` · ↓ ${d.hora_retorno}`}
                              </span>
                            )}
                          </div>
                          {(d.desde || d.hasta) && (
                            <p className="text-xs text-gray-500 leading-snug">
                              {d.desde && <><span className="font-medium text-gray-700">{d.desde.split(',')[0]}</span></>}
                              {d.desde && d.hasta && <span className="mx-1 text-gray-400">→</span>}
                              {d.hasta && <span className="font-medium text-gray-700">{d.hasta.split(',')[0]}</span>}
                            </p>
                          )}
                          {d.tiene_paradas && d.obs_paradas && (
                            <p className="text-xs text-gray-400 mt-1 italic">📍 {d.obs_paradas}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }

              // ── OTROS EMBUDOS (Servicio Especial, Salidas Educativas, etc.) ──
              const desde = (q as { desde?: string }).desde
              const hasta = (q as { hasta?: string }).hasta
              const firstItem = items[0] as { description?: string } | undefined
              const desc = firstItem?.description ?? ''
              const moreItems = items.length > 1 ? ` + ${items.length - 1} más` : ''
              const hasContent = q.fecha_salida || desc || desde || hasta
              if (!hasContent) return null
              return (
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md">
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-3">Resumen del servicio</p>
                  <div className="space-y-2.5">
                    {q.fecha_salida && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">📅</span>
                        <div>
                          <p className="text-blue-200 text-xs uppercase tracking-wide leading-none mb-0.5">Fecha</p>
                          <p className="font-bold text-sm leading-tight">{formatDate(q.fecha_salida)}{q.hora_salida ? ` · ${(q.hora_salida as string).slice(0,5)} hrs` : ''}</p>
                        </div>
                      </div>
                    )}
                    {desc && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">📋</span>
                        <div>
                          <p className="text-blue-200 text-xs uppercase tracking-wide leading-none mb-0.5">Servicio</p>
                          <p className="font-semibold text-sm leading-tight">{desc}{moreItems}</p>
                        </div>
                      </div>
                    )}
                    {(desde || hasta) && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">🗺️</span>
                        <div>
                          <p className="text-blue-200 text-xs uppercase tracking-wide leading-none mb-0.5">Ruta</p>
                          <p className="font-semibold text-sm leading-tight">
                            {desde?.split(',')[0]}{desde && hasta && ' → '}{hasta?.split(',')[0]}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Acciones comerciales destacadas */}
            {!isReadOnly && q.status === 'open' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Aprobación de cotización</p>
                <p className="text-xs text-blue-600 mb-3">Genera un link de firma digital para que el cliente acepte o rechace esta cotización.</p>
                <QuotationApprovalButton quotationId={id} isTKS={isTKS} />
              </div>
            )}
            {!isReadOnly && q.status === 'won' && (
              <div className="space-y-3">
                {/* Advertencia si fue ganada sin aprobación digital */}
                <QuotationApprovalButton quotationId={id} wonMode isTKS={isTKS} />
                {/* Carta de aprobación (no para traslado diario) */}
                {!pipeline?.name?.toLowerCase().includes('traslado diario') && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Carta de aprobación de servicio</p>
                    <p className="text-xs text-green-600 mb-3">Genera y envía la carta de aprobación para que el cliente firme digitalmente antes del servicio.</p>
                    <ApprovalLetterButton quotationId={id} />
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Cliente</h2>
              <p className="font-bold text-gray-900 text-lg">{q.clients?.name ?? '—'}</p>
              {q.clients?.rut && <p className="text-sm text-gray-500">RUT: {q.clients.rut}</p>}
              {q.clients?.email && <p className="text-sm text-gray-500">{q.clients.email}</p>}
              {q.clients?.phone && <p className="text-sm text-gray-500">{q.clients.phone}</p>}
              {q.clients?.address && <p className="text-sm text-gray-500">{q.clients.address}</p>}
            </div>

            <div className="bg-white rounded-xl border p-5 grid grid-cols-2 gap-4 text-sm">
              {q.fecha_salida && (
                <div className="col-span-2 pb-3 border-b">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Fecha del servicio (cierre previsto)</p>
                  <p className="font-bold text-gray-900 text-base">{formatDate(q.fecha_salida)}{q.hora_salida ? ` · ${q.hora_salida.slice(0,5)}` : ''}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Fecha emisión</p>
                <p className="font-medium text-gray-800">{q.issue_date ? formatDate(q.issue_date) : '—'}</p>
              </div>
              {q.expiry_date && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Vencimiento</p>
                  <p className="font-medium text-gray-800">{formatDate(q.expiry_date)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total</p>
                <p className="font-bold text-gray-900 text-lg" style={{ color: '#1B8A4B' }}>{formatCLP(q.total)}</p>
              </div>
              {q.profiles?.name && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Ejecutivo</p>
                  <p className="font-medium text-gray-800">{q.profiles.name}</p>
                </div>
              )}
            </div>

            {/* Contacto del negocio */}
            {(q as {contact_name?: string; contact_cargo?: string; contact_email?: string; contact_phone_mobile?: string; contact_phone_landline?: string}).contact_name && (
              <div className="bg-white rounded-xl border p-5">
                <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Contacto</h2>
                {(() => {
                  const c = q as {contact_name?: string; contact_cargo?: string; contact_email?: string; contact_phone_mobile?: string; contact_phone_landline?: string}
                  return (
                    <>
                      <p className="font-bold text-gray-900">{c.contact_name}</p>
                      {c.contact_cargo && <p className="text-sm text-gray-500">{c.contact_cargo}</p>}
                      {c.contact_email && <p className="text-sm text-gray-500">{c.contact_email}</p>}
                      {c.contact_phone_mobile && <p className="text-sm text-gray-500">📱 {c.contact_phone_mobile}</p>}
                      {c.contact_phone_landline && <p className="text-sm text-gray-500">☎ {c.contact_phone_landline}</p>}
                    </>
                  )
                })()}
              </div>
            )}

            {(q.notes || q.terms) && (
              <div className="grid grid-cols-2 gap-4">
                {q.notes && (
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm">Notas</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.notes}</p>
                  </div>
                )}
                {q.terms && (
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm">Términos</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.terms}</p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {tab === 'items' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Descripción</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Cant.</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Precio unit.</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
                    .map((item: { id: string; description: string; quantity: number; unit_price: number; subtotal: number }) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCLP(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCLP(item.subtotal)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-500">Subtotal neto</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700">{formatCLP(q.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-500">IVA ({q.tax_pct}%)</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700">{formatCLP(q.subtotal * q.tax_pct / 100)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right text-gray-900 text-base" style={{ color: '#1B8A4B' }}>{formatCLP(q.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {tab === 'gestiones' && (
          <div className="max-w-2xl">
            <ActivitiesPanel
              quotationId={id}
              initialActivities={activitiesWithName}
              userId={user?.id ?? ''}
            />
          </div>
        )}

        {tab === 'notas' && (
          <div className="max-w-2xl">
            <NotesPanel
              quotationId={id}
              initialNotes={notesWithName}
              userId={user?.id ?? ''}
            />
          </div>
        )}

        {tab === 'documentos' && (
          <DocumentsTab quotationId={id} />
        )}
      </div>
    </div>
  )
}
