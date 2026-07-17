import { createClient } from '@/lib/supabase/server'
import QuotationForm from '@/components/quotations/QuotationForm'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: clients } = await supabase.from('clients').select('id, name, rut, contacto, telefono_fijo, telefono_celular, email').order('name')
  const { data: sellers } = await supabase.from('profiles').select('id, name, email').order('name')
  const pipelines = await getPipedrivePipelines()

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva cotización</h1>
      <QuotationForm clients={clients ?? []} pipelines={pipelines} sellers={sellers ?? []} userId={user!.id} />
    </div>
  )
}
