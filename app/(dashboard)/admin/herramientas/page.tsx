import { getSession } from '@/lib/api'
import { redirect } from 'next/navigation'
import HerramientasAdmin from '@/components/admin/HerramientasAdmin'

export default async function HerramientasPage() {
  const user = await getSession()
  if (user?.role !== 'admin') redirect('/dashboard')
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Herramientas de administración</h1>
      <HerramientasAdmin />
    </div>
  )
}
