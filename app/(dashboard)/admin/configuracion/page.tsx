import { getSession } from '@/lib/api'
import { redirect } from 'next/navigation'
import AdminConfigClient from '@/components/admin/AdminConfigClient'

export default async function AdminConfigPage() {
  const user = await getSession()
  if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) redirect('/dashboard')
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración del sistema</h1>
      <p className="text-sm text-gray-500 mb-6">Solo visible para administradores</p>
      <AdminConfigClient />
    </div>
  )
}
