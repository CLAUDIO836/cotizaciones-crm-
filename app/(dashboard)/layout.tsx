import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ChatBox from '@/components/ChatBox'
import { getSession, getToken, crmGet } from '@/lib/api'
import { fetchAiLandingStats } from '@/lib/ai-api'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const token = await getToken()
  const [leadsRes, aiStats] = await Promise.all([
    crmGet('leads_pending_count', {}, token),
    fetchAiLandingStats(),
  ])
  const pendingLeads = (leadsRes?.data as { count: number } | null)?.count ?? 0
  const agentAttention = aiStats.attention > 0 ? aiStats.attention : undefined

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f5f7' }}>
      <Sidebar profile={{
        id: session.id,
        name: session.name,
        role: session.role,
        pending_leads: pendingLeads,
        agent_attention: agentAttention,
      }} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <ChatBox />
    </div>
  )
}
