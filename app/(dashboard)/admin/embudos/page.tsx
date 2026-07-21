import { getSession, fetchPipelines } from '@/lib/api'
import { redirect } from 'next/navigation'
import PipelinesManager from '@/components/pipelines/PipelinesManager'

export default async function EmbudosPage() {
  const user = await getSession()
  if (user?.role !== 'admin') redirect('/dashboard')
  const pipelines = await fetchPipelines(true)

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Embudos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Categorías para organizar las cotizaciones</p>
      </div>
      <PipelinesManager initialPipelines={pipelines} />
    </div>
  )
}
