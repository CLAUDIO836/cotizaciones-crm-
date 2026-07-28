import { notFound } from 'next/navigation'
import { fetchAiConversation } from '@/lib/ai-api'
import { getSession } from '@/lib/api'
import ConversationView from '@/components/agent/ConversationView'

export const dynamic = 'force-dynamic'

export default async function ConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [conversation, session] = await Promise.all([
    fetchAiConversation(id),
    getSession(),
  ])

  if (!conversation || !session) notFound()

  return <ConversationView conversation={conversation!} session={session!} />
}
