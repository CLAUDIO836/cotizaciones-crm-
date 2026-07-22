export const dynamic = 'force-dynamic'
import { getSession, fetchQuotation, fetchClients, fetchProfiles, fetchCompanies } from '@/lib/api'
import QuotationForm from '@/components/quotations/QuotationForm'
import { notFound, redirect } from 'next/navigation'

async function getPipedrivePipelines() {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return []
  try {
    const res = await fetch(`https://api.pipedrive.com/v1/pipelines?api_token=${token}`, { next: { revalidate: 300 } })
    const json = await res.json()
    return (json.data ?? []).map((p: { id: number; name: string }) => ({
      id: String(p.id),
      name: p.name,
      color: '#1B8A4B',
    }))
  } catch { return [] }
}

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [q, clients, sellers, companies, pipelines] = await Promise.all([
    fetchQuotation(id),
    fetchClients(),
    fetchProfiles(),
    fetchCompanies(),
    getPipedrivePipelines(),
  ])

  if (!q) notFound()

  const quotationData = {
    id: q.id,
    client_id: q.client_id ?? '',
    pipeline_id: q.pipeline_id,
    etapa: q.etapa,
    vehicle_type: q.vehicle_type,
    issue_date: q.issue_date,
    expiry_date: q.expiry_date,
    desde: q.desde,
    hasta: q.hasta,
    fecha_salida: q.fecha_salida,
    fecha_destino: q.fecha_destino,
    descuento_pct: q.descuento_pct,
    observaciones: q.observaciones,
    notes: q.notes,
    terms: q.terms,
    tax_pct: q.tax_pct,
    items: (q.quotation_items ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((i: { codigo?: string; description: string; pasajeros?: number; quantity: number; unit_price: number }) => ({
        codigo: i.codigo ?? '',
        description: i.description,
        pasajeros: i.pasajeros ?? 0,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar cotización {q.number}</h1>
      <QuotationForm
        clients={clients ?? []}
        pipelines={pipelines}
        sellers={sellers ?? []}
        companies={companies ?? []}
        userId={session.id}
        quotation={quotationData}
      />
    </div>
  )
}
