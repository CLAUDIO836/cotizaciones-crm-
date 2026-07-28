'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RefreshCw, User } from 'lucide-react'
import type { AiMessage, AiConversationDetail } from '@/lib/ai-api'

interface Props {
  draft: AiMessage
  conv: AiConversationDetail
}

export default function DraftPanel({ draft, conv }: Props) {
  const router = useRouter()
  const [content, setContent] = useState(draft.content)
  const [editing, setEditing] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState<'approve' | 'reject' | 'control' | null>(null)

  async function handleApprove() {
    setLoading('approve')
    try {
      const edited = content !== draft.content ? content : undefined
      await fetch(`/api/ai/messages/${draft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: edited }),
      })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject')
    try {
      await fetch(`/api/ai/messages/${draft.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectNote || null }),
      })
      setShowReject(false)
      setRejectNote('')
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleTakeControl() {
    setLoading('control')
    try {
      await fetch(`/api/ai/conversations/${conv.id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'human' }),
      })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#FCD34D' }}>
        <div>
          <p className="text-sm font-semibold text-amber-900">Borrador generado por IA</p>
          <p className="text-xs text-amber-700">Revisa antes de aprobar y enviar</p>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs text-amber-700 underline underline-offset-2"
        >
          {editing ? 'Vista previa' : 'Editar'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {editing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            className="w-full text-sm rounded-lg border p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            style={{ borderColor: '#FCD34D', background: '#FEFCE8' }}
          />
        ) : (
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {content}
          </pre>
        )}
      </div>

      {/* Reject note input */}
      {showReject && (
        <div className="px-4 pb-3">
          <textarea
            placeholder="Motivo del rechazo (opcional)…"
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            rows={2}
            className="w-full text-sm rounded-lg border p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            style={{ borderColor: '#FCA5A5', background: '#FEF2F2' }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {!showReject ? (
          <>
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: '#1B8A4B' }}
            >
              <CheckCircle className="w-4 h-4" />
              {loading === 'approve' ? 'Aprobando…' : 'Aprobar y enviar'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-60"
              style={{ borderColor: '#FCA5A5', color: '#DC2626', background: '#FEF2F2' }}
            >
              <XCircle className="w-4 h-4" />
              Solicitar nueva versión
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-60"
              style={{ background: '#DC2626' }}
            >
              <XCircle className="w-4 h-4" />
              {loading === 'reject' ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="text-xs text-gray-500 underline underline-offset-2"
            >
              Cancelar
            </button>
          </>
        )}

        {conv.mode === 'ai' && (
          <button
            onClick={handleTakeControl}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-60"
            style={{ borderColor: '#BFDBFE', color: '#1D4ED8', background: '#EFF6FF' }}
          >
            <User className="w-3.5 h-3.5" />
            {loading === 'control' ? 'Cambiando…' : 'Tomar control'}
          </button>
        )}
      </div>
    </div>
  )
}
