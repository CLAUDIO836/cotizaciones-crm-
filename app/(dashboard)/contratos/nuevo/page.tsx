import { createClient } from '@/lib/supabase/server'
import ContractForm from '@/components/contracts/ContractForm'

export default async function NuevoContratoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: clients } = await supabase.from('clients').select('id, name').order('name')

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo contrato</h1>
      <ContractForm clients={clients ?? []} userId={user!.id} />
    </div>
  )
}
