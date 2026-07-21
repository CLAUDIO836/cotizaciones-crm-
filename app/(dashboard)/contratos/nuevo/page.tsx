import ContractForm from '@/components/contracts/ContractForm'
import { getSession, fetchClients } from '@/lib/api'
import { redirect } from 'next/navigation'

export default async function NuevoContratoPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const clients = await fetchClients()

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo contrato</h1>
      <ContractForm clients={clients ?? []} userId={session.id} />
    </div>
  )
}
