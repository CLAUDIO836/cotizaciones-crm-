import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { count: pendingLeads } = await supabase
    .from('lead_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendiente')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f5f7' }}>
      <Sidebar profile={profile ? { ...profile, pending_leads: pendingLeads ?? 0 } : null} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
