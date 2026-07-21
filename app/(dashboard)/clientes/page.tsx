import { fetchClients } from '@/lib/api'
import ClientsManager from '@/components/clients/ClientsManager'

export default async function ClientesPage() {
  const clients = await fetchClients()
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
      <ClientsManager initialClients={clients} />
    </div>
  )
}
