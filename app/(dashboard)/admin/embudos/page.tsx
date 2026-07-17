import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PipelinesManager from '@/components/pipelines/PipelinesManager'

export default async function EmbudosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('*')
    .order('sort_order')

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Embudos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Categorías para organizar las cotizaciones</p>
      </div>
      <PipelinesManager initialPipelines={pipelines ?? []} />
    </div>
  )
}
