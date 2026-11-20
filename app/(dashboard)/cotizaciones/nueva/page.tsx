import QuotationForm from '@/components/quotations/QuotationForm'
import { getSession, fetchClients, fetchProfiles, fetchCompanies, fetchWaConv, fetchLeadById } from '@/lib/api'
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
  searchParams: Promise<{ phone?: string; name?: string; conv_id?: string; lead_id?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const params = await searchParams

  // Si hay una conversación con borrador activo, redirigir a editar (no crear duplicado)
  if (params.conv_id) {
    const waConvCheck = await fetchWaConv(params.conv_id)
    if (waConvCheck?.wa_draft_quote_id) {
      const draftId = waConvCheck.wa_draft_quote_id
      const extra = [
        `conv_id=${params.conv_id}`,
        params.phone ? `phone=${encodeURIComponent(params.phone)}` : '',
        params.name  ? `name=${encodeURIComponent(params.name)}`   : '',
      ].filter(Boolean).join('&')
      redirect(`/cotizaciones/${draftId}/editar?${extra}`)
    }
  }

  const [clients, sellers, companies, pipelines, waConv, lead] = await Promise.all([
    fetchClients(),
    fetchProfiles(),
    fetchCompanies(),
    getPipedrivePipelines(),
    params.conv_id ? fetchWaConv(params.conv_id) : Promise.resolve(null),
    params.lead_id ? fetchLeadById(params.lead_id) : Promise.resolve(null),
  ])

  // Datos prefill: lead tiene prioridad sobre waConv
  const pPhone      = params.phone   ?? lead?.contacto_telefono ?? waConv?.phone
  const pName       = params.name    ?? lead?.contacto_nombre   ?? waConv?.contact_name  ?? undefined
  const pRUT        = lead?.empresa_rut       ?? waConv?.contact_rut        ?? undefined
  const pEmail      = lead?.contacto_email    ?? waConv?.contact_email      ?? undefined
  const pService    = lead?.tipo_servicio     ?? waConv?.service_type       ?? undefined
  const pOrigin     = lead?.desde             ?? waConv?.service_origin     ?? undefined
  const pDest       = lead?.hasta             ?? waConv?.service_destination ?? undefined
  const pDate       = lead?.fecha_inicio      ?? waConv?.service_date       ?? undefined
  const pHoraSal    = lead?.service_hour      ?? waConv?.service_hour       ?? undefined
  const pHoraRet    = lead?.service_hour_return ?? waConv?.service_hour_return ?? undefined
  const pPassengers = lead?.pasajeros_aprox   ?? waConv?.service_passengers ?? undefined
  const pVehicle    = lead?.service_vehicle   ?? lead?.vehiculo_preferido   ?? waConv?.service_vehicle ?? undefined

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva cotización</h1>
      <QuotationForm
        clients={clients ?? []}
        pipelines={pipelines}
        sellers={sellers ?? []}
        companies={companies ?? []}
        userId={session.id}
        prefilledPhone={pPhone}
        prefilledName={pName}
        prefilledRUT={pRUT}
        prefilledEmail={pEmail}
        prefilledService={pService}
        prefilledOrigin={pOrigin}
        prefilledDestination={pDest}
        prefilledDate={pDate}
        prefilledHoraSalida={pHoraSal}
        prefilledHoraRetorno={pHoraRet}
        prefilledPassengers={pPassengers !== undefined ? Number(pPassengers) : undefined}
        prefilledVehicle={pVehicle}
      />
    </div>
  )
}
