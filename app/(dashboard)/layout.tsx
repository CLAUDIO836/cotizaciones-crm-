import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatBox from '@/components/ChatBox'
import CelularModal from '@/components/CelularModal'
import FloatingSoftphone from '@/components/FloatingSoftphone'
import { getSession, getToken, crmGet } from '@/lib/api'
import { fetchAiLandingStats } from '@/lib/ai-api'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const token = await getToken()
  const [leadsRes, aiStats, autzRes] = await Promise.all([
    crmGet('leads_pending_count', {}, token),
    fetchAiLandingStats(),
    // si la acción no existe todavía en el servidor, el menú sigue funcionando
    crmGet('autz_pending_count', {}, token).catch(() => null),
  ])
  const pendingLeads = (leadsRes?.data as { count: number } | null)?.count ?? 0
  const agentAttention = aiStats.attention > 0 ? aiStats.attention : undefined
  const autzPending = (autzRes?.data as { count: number } | null)?.count || undefined

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f5f7' }}>
      {!session.celular && <CelularModal />}
      <Suspense fallback={null}>
        <Sidebar profile={{
          id: session.id,
          name: session.name,
          role: session.role,
          pending_leads: pendingLeads,
          agent_attention: agentAttention,
          autz_pending: autzPending,
        }} />
      </Suspense>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <ChatBox />
      <FloatingSoftphone />
    </div>
  )
}
