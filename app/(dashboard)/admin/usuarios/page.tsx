import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersManager from '@/components/admin/UsersManager'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('name')

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
      <UsersManager users={users ?? []} />
    </div>
  )
}
