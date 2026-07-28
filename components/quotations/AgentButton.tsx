'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AgentButton({
  quotationId,
  clientId,
  subject,
}: {
  quotationId: string
  clientId?: string
  subject?: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          channel: 'crm',
          priority: 'medium',
          subject: subject ?? `Negocio #${quotationId}`,
        }),
      })
      const data = await res.json()
      if (data?.id) router.push(`/agente/conversaciones/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs h-7 px-2.5"
      style={{ borderColor: '#BBF7D0', color: '#1B8A4B' }}
      onClick={handleClick}
      disabled={loading}
    >
      <Bot className="w-3 h-3 mr-1" />
      {loading ? 'Iniciando…' : 'Agente IA'}
    </Button>
  )
}
