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
import AgentButton from '@/components/quotations/AgentButton'

const STAGES_ORDER = ['lead', 'contactado', 'cotizacion', 'negociacion', 'cierre']

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
  const { label: statusLabel, color: statusColor } = getStatusLabel(q.status)
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

  const pipelineName = (pipeline?.name ?? q.pipeline_name ?? '').toLowerCase()
  const isDiario = pipelineName.includes('diario')

  type DiarioItem = { ruta: string; desde: string; hasta: string; hora_salida: string; hora_retorno: string; tiene_paradas: boolean; obs_paradas: string }
  const diarioItems: DiarioItem[] = []
  for (const it of items as { description?: string }[]) {
    try {
      const p = JSON.parse((it as { description?: string }).description ?? '')
      if (p?.__diario) diarioItems.push(p as DiarioItem)
    } catch { /* not json */ }
  }

  const totalMensual = (items as { quantity?: number; unit_price?: number }[]).reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0), 0)
  const stageIdx = STAGES_ORDER.indexOf(q.etapa ?? 'lead')

  const desde = (q as { desde?: string }).desde
  const hasta = (q as { hasta?: string }).hasta
  const contact = q as { contact_name?: string; contact_cargo?: string; contact_email?: string; contact_phone_mobile?: string; contact_phone_landline?: string }

  // Status badge style
  const statusBg = statusColor.includes('green') ? '#dcfce7' : statusColor.includes('red') ? '#fee2e2' : '#dbeafe'
  const statusFg = statusColor.includes('green') ? '#16a34a' : statusColor.includes('red') ? '#D33A2C' : '#2563eb'

  return (
    <div className="flex flex-col h-full">
      <AutoRefresh intervalMs={5000} />

      {/* Compact top header */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <Link href="/cotizaciones" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="font-bold text-gray-900 text-sm flex-shrink-0">#{q.number}</span>
        <span className="text-sm text-gray-400 truncate min-w-0">
          {q.clients?.name}{q.profiles?.name ? ` · ${q.profiles.name}` : ''}
        </span>
        <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-semibold flex-shrink-0"
          style={{ background: statusBg, color: statusFg }}>{statusLabel}</span>
      </div>

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <div
          className="flex-shrink-0 border-r overflow-y-auto flex flex-col"
          style={{ width: 240, background: '#f9fafb' }}
        >
          {/* Badges */}
          <div className="px-3 pt-3 pb-2 border-b">
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: etapa.bg, color: etapa.color }}>{etapa.label}</span>
              <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: brandBadge.bg, color: brandBadge.color }}>{brandBadge.label}</span>
              {(pipeline?.name ?? q.pipeline_name) && (
                <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pipeline?.name ?? q.pipeline_name}
                </span>
              )}
            </div>
          </div>

          {/* Valor */}
          <div className="px-3 py-3 border-b">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              {isDiario ? 'Valor mensual' : 'Valor total'}
            </p>
            <p className="text-xl font-bold" style={{ color: '#1B8A4B' }}>{formatCLP(isDiario ? totalMensual : q.total)}</p>
            {isDiario && (
              <p className="text-xs text-gray-400">Anual · {formatCLP(totalMensual * 12)}</p>
            )}
          </div>

          {/* Etapa / Stage bar */}
          <div className="px-3 py-2.5 border-b">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Embudo</p>
            <div className="flex gap-1 mb-1">
              {STAGES_ORDER.map((s, i) => (
                <div
                  key={s}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    background: i < stageIdx ? '#86efac' : i === stageIdx ? '#1B8A4B' : '#e5e7eb'
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Lead</span>
              <span className="text-xs font-medium" style={{ color: '#1B8A4B' }}>{etapa.label}</span>
              <span className="text-xs text-gray-400">Cierre</span>
            </div>
          </div>

          {/* Ganado / Perdido */}
          {!isReadOnly && (
            <div className="px-3 py-2.5 border-b">
              <StatusActions
                quotationId={q.id}
                quotationNumber={q.number}
                clientId={q.client_id ?? ''}
                userId={q.user_id ?? ''}
                total={q.total}
                status={q.status}
                pipedriveDealId={q.pipedrive_deal_id}
                inline
              />
            </div>
          )}

          {/* Cliente */}
          <div className="px-3 py-2.5 border-b">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-sm text-gray-900 leading-tight">{q.clients?.name ?? '—'}</p>
            {q.clients?.rut && <p className="text-xs text-gray-500 mt-0.5">RUT: {q.clients.rut}</p>}
            {q.clients?.email && <p className="text-xs text-gray-500">{q.clients.email}</p>}
            {q.clients?.phone && <p className="text-xs text-gray-500">{q.clients.phone}</p>}
            {q.clients?.address && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{q.clients.address}</p>}
          </div>

          {/* Contacto */}
          {contact.contact_name && (
            <div className="px-3 py-2.5 border-b">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Contacto</p>
              <p className="font-semibold text-sm text-gray-900">{contact.contact_name}</p>
              {contact.contact_cargo && <p className="text-xs text-gray-500">{contact.contact_cargo}</p>}
              {contact.contact_email && <p className="text-xs text-gray-500">{contact.contact_email}</p>}
              {contact.contact_phone_mobile && <p className="text-xs text-gray-500">📱 {contact.contact_phone_mobile}</p>}
              {contact.contact_phone_landline && <p className="text-xs text-gray-500">☎ {contact.contact_phone_landline}</p>}
            </div>
          )}

          {/* Service detail — adapts by pipeline */}
          {isDiario && diarioItems.length > 0 ? (
            <div className="px-3 py-2.5 border-b">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#1B8A4B' }}>
                Rutas del servicio · {diarioItems.length} {diarioItems.length === 1 ? 'ruta' : 'rutas'}
              </p>
              <div className="space-y-2">
                {diarioItems.map((d, i) => (
                  <div key={i} className="bg-white rounded-lg border p-2">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-xs text-gray-900 leading-tight">{d.ruta || `Ruta ${i + 1}`}</span>
                      {(d.hora_salida || d.hora_retorno) && (
                        <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1B8A4B' }}>
                          {d.hora_salida && `↑${d.hora_salida}`}{d.hora_retorno && ` ↓${d.hora_retorno}`}
                        </span>
                      )}
                    </div>
                    {(d.desde || d.hasta) && (
                      <p className="text-xs text-gray-500 leading-tight">
                        {d.desde?.split(',')[0]}
                        {d.desde && d.hasta && <span className="mx-1 text-gray-300">→</span>}
                        {d.hasta?.split(',')[0]}
                      </p>
                    )}
                    {d.tiene_paradas && d.obs_paradas && (
                      <p className="text-xs text-gray-400 mt-0.5 italic leading-tight">📍 {d.obs_paradas}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (desde || hasta || q.fecha_salida) ? (
            <div className="px-3 py-2.5 border-b">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#7e22ce' }}>
                Detalle del servicio
              </p>
              {q.fecha_salida && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400">Fecha del servicio</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(q.fecha_salida)}
                    {q.hora_salida ? ` · ${(q.hora_salida as string).slice(0,5)}` : ''}
                  </p>
                </div>
              )}
              {(desde || hasta) && (
                <div className="bg-white rounded-lg border p-2">
                  <p className="text-xs text-gray-400 mb-0.5">Ruta del viaje</p>
                  {desde && <p className="text-xs font-medium text-gray-800 leading-tight">{desde.split(',')[0]}</p>}
                  {desde && hasta && <p className="text-xs text-gray-300 my-0.5">↓</p>}
                  {hasta && <p className="text-xs font-medium text-gray-800 leading-tight">{hasta.split(',')[0]}</p>}
                </div>
              )}
            </div>
          ) : null}

          {/* Negocio fields */}
          <div className="px-3 py-2.5 space-y-2">
            <div>
              <p className="text-xs text-gray-400">Fecha emisión</p>
              <p className="text-sm text-gray-800">{q.issue_date ? formatDate(q.issue_date) : '—'}</p>
            </div>
            {q.expiry_date && (
              <div>
                <p className="text-xs text-gray-400">Vencimiento</p>
                <p className="text-sm text-gray-800">{formatDate(q.expiry_date)}</p>
              </div>
            )}
            {q.profiles?.name && (
              <div>
                <p className="text-xs text-gray-400">Ejecutivo</p>
                <p className="text-sm text-gray-800">{q.profiles.name}</p>
              </div>
            )}
            {q.pipedrive_deal_id && (
              <div>
                <p className="text-xs text-gray-400">Pipedrive</p>
                <p className="text-sm text-gray-800">Deal #{q.pipedrive_deal_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">

          {/* Action buttons topbar */}
          <div className="border-b px-4 py-2 flex items-center gap-1.5 flex-wrap flex-shrink-0" style={{ background: '#f9fafb' }}>
            <a href={`/api/cotizaciones/${id}/html`} target="_blank">
              <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">
                <Globe className="w-3 h-3 mr-1" />
                Ver / Imprimir
              </Button>
            </a>
            {!isTracking && (
              <>
                <a href={`/api/cotizaciones/${id}/propuesta`} target="_blank">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" style={{ borderColor: '#1B8A4B', color: '#1B8A4B' }}>
                    <Globe className="w-3 h-3 mr-1" />
                    Propuesta
                  </Button>
                </a>
                <a href={`/api/cotizaciones/${id}/propuesta/download`} download>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" style={{ borderColor: '#1B8A4B', color: '#1B8A4B' }}>
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
                desde={desde}
                hasta={hasta}
              />
            )}
            {!isReadOnly && (
              <Link href={`/cotizaciones/${id}/editar`}>
                <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              </Link>
            )}
            {!isReadOnly && (
              <DeleteButton quotationId={id} pipedriveDealId={q.pipedrive_deal_id} />
            )}
            <AgentButton
              quotationId={id}
              clientId={q.client_id ?? undefined}
              subject={`${q.clients?.name ?? ''} · #${q.number}`}
            />
          </div>

          {/* Tabs */}
          <QuotationTabs
            quotationId={id}
            currentTab={tab}
            activitiesCount={activities.length}
            notesCount={notes.length}
          />

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-5">

            {tab === 'datos' && (
              <div className="max-w-xl space-y-4">
                {/* Aprobación comercial */}
                {!isReadOnly && q.status === 'open' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Aprobación de cotización</p>
                    <p className="text-xs text-blue-600 mb-3">Genera un link de firma digital para que el cliente acepte o rechace esta cotización.</p>
                    <QuotationApprovalButton quotationId={id} isTKS={isTKS} />
                  </div>
                )}
                {!isReadOnly && q.status === 'won' && (
                  <div className="space-y-3">
                    <QuotationApprovalButton quotationId={id} wonMode isTKS={isTKS} />
                    {!isDiario && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Carta de aprobación de servicio</p>
                        <p className="text-xs text-green-600 mb-3">Genera y envía la carta de aprobación para que el cliente firme digitalmente antes del servicio.</p>
                        <ApprovalLetterButton quotationId={id} />
                      </div>
                    )}
                  </div>
                )}
                {/* Notas y términos */}
                {(q.notes || q.terms) && (
                  <div className="grid grid-cols-1 gap-4">
                    {q.notes && (
                      <div className="bg-white rounded-xl border p-4">
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">Notas internas</h3>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.notes}</p>
                      </div>
                    )}
                    {q.terms && (
                      <div className="bg-white rounded-xl border p-4">
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">Términos y condiciones</h3>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.terms}</p>
                      </div>
                    )}
                  </div>
                )}
                {!q.notes && !q.terms && q.status !== 'open' && q.status !== 'won' && (
                  <p className="text-sm text-gray-400 italic">Sin notas ni términos en esta cotización.</p>
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
                      {(items as { id: string; description: string; quantity: number; unit_price: number; subtotal: number; sort_order: number }[])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(item => (
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
                  initialActivities={activities}
                  userId={user?.id ?? ''}
                />
              </div>
            )}

            {tab === 'notas' && (
              <div className="max-w-2xl">
                <NotesPanel
                  quotationId={id}
                  initialNotes={notes}
                  userId={user?.id ?? ''}
                />
              </div>
            )}

            {tab === 'documentos' && (
              <DocumentsTab quotationId={id} />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
