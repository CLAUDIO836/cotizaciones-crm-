export const dynamic = 'force-dynamic'
import { getSession, fetchQuotation, fetchActivities, fetchNotes, fetchPipelines } from '@/lib/api'
import { notFound } from 'next/navigation'
import { formatCLP, formatDate, getStatusLabel } from '@/lib/utils'
import StatusActions from '@/components/quotations/StatusActions'
import ActivitiesPanel from '@/components/quotations/ActivitiesPanel'
import NotesPanel from '@/components/quotations/NotesPanel'
import QuotationTabs from '@/components/quotations/QuotationTabs'
import Link from 'next/link'
import { ArrowLeft, FileDown, Edit, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/quotations/DeleteButton'
import ApprovalLetterButton from '@/components/quotations/ApprovalLetterButton'
import QuotationApprovalButton from '@/components/quotations/QuotationApprovalButton'

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
  const activitiesWithName = activities
  const notesWithName = notes

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/cotizaciones" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{q.number}</h1>
            <span
              className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: color.includes('green') ? '#dcfce7' : color.includes('red') ? '#fee2e2' : '#dbeafe', color: color.includes('green') ? '#16a34a' : color.includes('red') ? '#D33A2C' : '#2563eb' }}
            >
              {label}
            </span>
            <span
              className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: etapa.bg, color: etapa.color }}
            >
              {etapa.label}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {q.clients?.name}
            {q.issue_date && ` · ${formatDate(q.issue_date)}`}
            {q.profiles?.name && ` · ${q.profiles.name}`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <a href={`/api/cotizaciones/${id}/html`} target="_blank">
            <Button variant="outline" size="sm">
              <Globe className="w-4 h-4 mr-1.5" />
              Ver / Imprimir
            </Button>
          </a>
          <a href={`/api/cotizaciones/${id}/pdf`} target="_blank">
            <Button variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-1.5" />
              PDF
            </Button>
          </a>
          {!isReadOnly && (
            <DeleteButton quotationId={id} />
          )}
          {!isReadOnly && (
            <Link href={`/cotizaciones/${id}/editar`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
            </Link>
          )}
          {!isReadOnly && (
            <StatusActions quotationId={q.id} quotationNumber={q.number} clientId={q.client_id ?? ''} userId={q.user_id ?? ''} total={q.total} status={q.status} inline />
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

            {/* Acciones comerciales destacadas */}
            {!isReadOnly && q.status === 'open' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Aprobación de cotización</p>
                <p className="text-xs text-blue-600 mb-3">Genera un link de firma digital para que el cliente acepte o rechace esta cotización.</p>
                <QuotationApprovalButton quotationId={id} />
              </div>
            )}
            {!isReadOnly && q.status === 'won' && (
              <div className="space-y-3">
                {/* Advertencia si fue ganada sin aprobación digital */}
                <QuotationApprovalButton quotationId={id} wonMode />
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
      </div>
    </div>
  )
}
