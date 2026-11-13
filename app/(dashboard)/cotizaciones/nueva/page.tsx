import QuotationForm from '@/components/quotations/QuotationForm'
import { getSession, fetchClients, fetchProfiles, fetchCompanies, fetchWaConv } from '@/lib/api'
import { redirect } from 'next/navigation'

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

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; name?: string; conv_id?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const params = await searchParams

  // Si hay una conversación con borrador activo, redirigir a editar (no crear duplicado)
  if (params.conv_id) {
    const waConvCheck = await fetchWaConv(params.conv_id)
    if (waConvCheck?.wa_draft_quote_id) {
      const draftId = waConvCheck.wa_draft_quote_id
      redirect(`/cotizaciones/${draftId}/editar?conv_id=${params.conv_id}`)
    }
  }

  const [clients, sellers, companies, pipelines, waConv] = await Promise.all([
    fetchClients(),
    fetchProfiles(),
    fetchCompanies(),
    getPipedrivePipelines(),
    params.conv_id ? fetchWaConv(params.conv_id) : Promise.resolve(null),
  ])

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva cotización</h1>
      <QuotationForm
        clients={clients ?? []}
        pipelines={pipelines}
        sellers={sellers ?? []}
        companies={companies ?? []}
        userId={session.id}
        prefilledPhone={params.phone ?? waConv?.phone}
        prefilledName={params.name ?? waConv?.contact_name ?? undefined}
        prefilledRUT={waConv?.contact_rut ?? undefined}
        prefilledEmail={waConv?.contact_email ?? undefined}
        prefilledService={waConv?.service_type ?? undefined}
        prefilledOrigin={waConv?.service_origin ?? undefined}
        prefilledDestination={waConv?.service_destination ?? undefined}
        prefilledDate={waConv?.service_date ?? undefined}
        prefilledHoraSalida={waConv?.service_hour ?? undefined}
        prefilledHoraRetorno={waConv?.service_hour_return ?? undefined}
        prefilledPassengers={waConv?.service_passengers ?? undefined}
        prefilledVehicle={waConv?.service_vehicle ?? undefined}
      />
    </div>
  )
}
