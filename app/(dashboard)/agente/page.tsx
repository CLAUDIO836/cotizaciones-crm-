import { fetchAiLandingStats, fetchAiConversations, fetchAiAgentSettings } from '@/lib/ai-api'
import AgentLandingPanel from '@/components/agent/AgentLandingPanel'

export const dynamic = 'force-dynamic'

export default async function AgentePage() {
  const [stats, conversations, settings] = await Promise.all([
    fetchAiLandingStats(),
    fetchAiConversations(),
    fetchAiAgentSettings(),
  ])

  return (
    <AgentLandingPanel
      stats={stats}
      conversations={conversations}
      agentEnabled={settings?.enabled ?? false}
      companyId={settings?.company_id}
    />
  )
}
