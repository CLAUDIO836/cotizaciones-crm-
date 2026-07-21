import { getSession, fetchProfiles } from '@/lib/api'
import { redirect } from 'next/navigation'
import UsersManager from '@/components/admin/UsersManager'

export default async function UsuariosPage() {
  const user = await getSession()
  if (user?.role !== 'admin') redirect('/dashboard')
  const users = await fetchProfiles()

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
      <UsersManager users={users} />
    </div>
  )
}
