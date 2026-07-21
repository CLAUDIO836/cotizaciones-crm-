import QuotationForm from '@/components/quotations/QuotationForm'
import { getSession, fetchClients, fetchProfiles, fetchCompanies } from '@/lib/api'
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

export default async function NuevaCotizacionPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const [clients, sellers, companies, pipelines] = await Promise.all([
    fetchClients(),
    fetchProfiles(),
    fetchCompanies(),
    getPipedrivePipelines(),
  ])

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva cotización</h1>
      <QuotationForm clients={clients ?? []} pipelines={pipelines} sellers={sellers ?? []} companies={companies ?? []} userId={session.id} />
    </div>
  )
}
