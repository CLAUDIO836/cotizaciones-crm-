import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getSession, getToken, crmGet } from '@/lib/api'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const token = await getToken()
  const leadsRes = await crmGet('leads_pending_count', {}, token)
  const pendingLeads = (leadsRes?.data as { count: number } | null)?.count ?? 0

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f5f7' }}>
      <Sidebar profile={{ id: session.id, name: session.name, role: session.role, pending_leads: pendingLeads }} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
