import { createClient } from '@/lib/supabase/server'
import AgendaView from '@/components/agenda/AgendaView'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tipo?: string; vendedor?: string }>
}) {
  const { filter = 'pendientes', tipo, vendedor } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  let query = supabase
    .from('quotation_activities')
    .select(`
      *,
      profiles(name),
      quotations(number, client_id, clients(name))
    `)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (filter === 'pendientes') query = query.eq('done', false)
  if (filter === 'hoy') {
    const today = new Date().toISOString().slice(0, 10)
    query = query.gte('due_date', today).lt('due_date', today + 'T23:59:59')
  }
  if (filter === 'vencidas') {
    query = query.eq('done', false).lt('due_date', new Date().toISOString())
  }
  if (tipo) query = query.eq('type', tipo)
  if (vendedor && profile?.role === 'admin') query = query.eq('user_id', vendedor)
  else if (profile?.role !== 'admin') query = query.eq('user_id', user!.id)

  const { data: activities = [] } = await query.limit(200)

  const { data: sellers } = profile?.role === 'admin'
    ? await supabase.from('profiles').select('id, name').order('name')
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (activities ?? []).map((a: any) => ({
    ...a,
    user_name: a.profiles?.name,
    quotation_number: a.quotations?.number,
    client_name: a.quotations?.clients?.name,
  }))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestiones y actividades de todos los negocios</p>
      </div>
      <AgendaView
        activities={mapped}
        sellers={sellers ?? []}
        currentFilter={filter}
        currentTipo={tipo}
        currentVendedor={vendedor}
        isAdmin={profile?.role === 'admin'}
        userId={user!.id}
      />
    </div>
  )
}
