import type { AiMessage } from '@/lib/ai-api'

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const SENDER_LABEL: Record<string, string> = {
  client: 'Cliente',
  ai: 'IA',
  human: 'Agente',
  system: 'Sistema',
}

export default function MessageBubble({ msg }: { msg: AiMessage }) {
  const isRight = msg.sender === 'ai' || msg.sender === 'human'
  const isSystem = msg.sender === 'system'
  const isPendingDraft = msg.sender === 'ai' && msg.message_type === 'draft' && msg.status === 'pending'
  const isRejected = msg.status === 'rejected'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    )
  }

  let bubbleBg = '#F3F4F6'
  let bubbleText = '#111827'
  let borderColor = 'transparent'

  if (isRight) {
    if (isPendingDraft) {
      bubbleBg = '#FFFBEB'
      borderColor = '#FCD34D'
      bubbleText = '#92400E'
    } else if (isRejected) {
      bubbleBg = '#FEF2F2'
      bubbleText = '#991B1B'
    } else if (msg.sender === 'ai') {
      bubbleBg = '#ECFDF5'
      bubbleText = '#065F46'
    } else {
      bubbleBg = '#EFF6FF'
      bubbleText = '#1E40AF'
    }
  }

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="max-w-[72%]">
        <div className={`flex items-center gap-2 mb-1 ${isRight ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-500">{SENDER_LABEL[msg.sender]}</span>
          {isPendingDraft && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Borrador pendiente
            </span>
          )}
          {isRejected && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              Rechazado
            </span>
          )}
          {msg.sender === 'ai' && msg.status === 'sent' && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
              Aprobado y enviado
            </span>
          )}
        </div>
        <div
          className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed border"
          style={{
            background: bubbleBg,
            color: bubbleText,
            borderColor,
            borderRadius: isRight ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          }}
        >
          {msg.content}
          {isRejected && msg.rejection_note && (
            <p className="mt-2 text-xs italic opacity-70">
              Motivo: {msg.rejection_note}
            </p>
          )}
        </div>
        <p className={`text-xs text-gray-400 mt-1 ${isRight ? 'text-right' : 'text-left'}`}>
          {timeStr(msg.created_at)}
        </p>
      </div>
    </div>
  )
}
