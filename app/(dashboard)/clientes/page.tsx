import { createClient } from '@/lib/supabase/server'
import ClientsManager from '@/components/clients/ClientsManager'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
      <ClientsManager initialClients={clients ?? []} />
    </div>
  )
}
