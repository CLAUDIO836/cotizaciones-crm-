'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Bot, MessageSquare, Clock, AlertTriangle, CheckCircle,
  ChevronRight, User, Pause, Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AiLandingStats, AiConversationSummary } from '@/lib/ai-api'

type Tab = 'todos' | 'leads' | 'seguimiento' | 'cotizar' | 'vencidos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'todos',       label: 'Todos' },
  { id: 'leads',       label: 'Nuevos leads' },
  { id: 'seguimiento', label: 'En seguimiento' },
  { id: 'cotizar',     label: 'Listos para cotizar' },
  { id: 'vencidos',    label: 'Vencidos' },
]

const PRIORITY: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#FEF2F2', text: '#DC2626', label: 'Alta' },
  medium: { bg: '#FFFBEB', text: '#D97706', label: 'Media' },
  low:    { bg: '#F0FDF4', text: '#16A34A', label: 'Baja' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

interface Props {
  stats: AiLandingStats
  conversations: AiConversationSummary[]
  agentEnabled: boolean
  companyId?: string
}

export default function AgentLandingPanel({ stats, conversations, agentEnabled, companyId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('todos')
  const [enabled, setEnabled] = useState(agentEnabled)
  const [toggling, setToggling] = useState(false)

  async function handleToggleAgent() {
    if (!companyId || toggling) return
    setToggling(true)
    const next = !enabled
    try {
      await fetch('/api/ai/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, enabled: next }),
      })
      setEnabled(next)
    } finally {
      setToggling(false)
    }
  }

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'leads':       return conversations.filter(c => c.tab_type === 'lead')
      case 'seguimiento': return conversations.filter(c => c.tab_type === 'seguimiento')
      case 'cotizar':     return conversations.filter(c => c.tab_type === 'cotizar')
      case 'vencidos':    return conversations.filter(c => c.tab_type === 'vencido')
      default:            return conversations
    }
  }, [activeTab, conversations])

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#ECFDF5' }}>
              <Bot className="w-5 h-5" style={{ color: '#1B8A4B' }} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-xl leading-tight">Agente Comercial IA</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-xs text-gray-500">{enabled ? 'Activo' : 'Pausado'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleAgent}
            disabled={toggling || !companyId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-60"
            style={enabled
              ? { borderColor: '#FCA5A5', color: '#DC2626', background: '#FEF2F2' }
              : { borderColor: '#BBF7D0', color: '#166534', background: '#F0FDF4' }
            }
          >
            {enabled
              ? <><Pause className="w-3.5 h-3.5" /> Pausar IA</>
              : <><Zap  className="w-3.5 h-3.5" /> Activar IA</>
            }
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={MessageSquare}
            label="Conversaciones activas"
            value={stats.total_active}
            color="#1B8A4B"
          />
          <StatCard
            icon={Clock}
            label="Borradores pendientes"
            value={stats.drafts_pending}
            color="#D97706"
            alert={stats.drafts_pending > 0}
          />
          <StatCard
            icon={AlertTriangle}
            label="Seguimientos vencidos"
            value={stats.follow_ups_overdue}
            color="#DC2626"
            alert={stats.follow_ups_overdue > 0}
          />
          <StatCard
            icon={CheckCircle}
            label="Listos para cotizar"
            value={stats.ready_to_quote}
            color="#2563EB"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 flex gap-1 border-b overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
        {TABS.map(t => {
          const count = t.id === 'todos'
            ? conversations.length
            : conversations.filter(c =>
                t.id === 'leads'       ? c.tab_type === 'lead'
              : t.id === 'seguimiento' ? c.tab_type === 'seguimiento'
              : t.id === 'cotizar'     ? c.tab_type === 'cotizar'
              :                          c.tab_type === 'vencido'
              ).length

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all ${
                activeTab === t.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === t.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bot className="w-10 h-10 mb-3 opacity-25" />
            <p className="text-sm">Sin conversaciones en este filtro</p>
            {activeTab === 'todos' && (
              <p className="text-xs mt-1">Las conversaciones aparecerán cuando lleguen leads</p>
            )}
          </div>
        )}
        {filtered.map(conv => (
          <ConversationCard key={conv.id} conv={conv} />
        ))}
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, alert,
}: {
  icon: LucideIcon
  label: string
  value: number
  color: string
  alert?: boolean
}) {
  return (
    <div
      className="rounded-xl p-3.5 border"
      style={{
        background: alert ? `${color}0D` : '#F9FAFB',
        borderColor: alert ? `${color}40` : '#E5E7EB',
      }}
    >
      <Icon className="w-4 h-4 mb-2" style={{ color }} />
      <p className="text-2xl font-bold leading-none" style={{ color: alert ? color : '#111827' }}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
    </div>
  )
}

// ── ConversationCard ──────────────────────────────────────────

function ConversationCard({ conv }: { conv: AiConversationSummary }) {
  const p = PRIORITY[conv.priority] ?? PRIORITY.medium
  const displayName = conv.empresa_nombre ?? conv.client_name ?? conv.contacto_nombre ?? 'Sin nombre'

  return (
    <Link href={`/agente/conversaciones/${conv.id}`}>
      <div
        className="bg-white rounded-xl border p-4 hover:border-green-300 hover:shadow-sm transition-all cursor-pointer"
        style={{ borderColor: conv.has_pending_draft ? '#FCD34D' : '#E5E7EB' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Tags row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: p.bg, color: p.text }}>
                {p.label}
              </span>
              {conv.company && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {conv.company}
                </span>
              )}
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                conv.mode === 'ai'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}>
                {conv.mode === 'ai' ? 'IA' : 'Agente'}
              </span>
            </div>

            <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>

            {conv.latest_message && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{conv.latest_message}</p>
            )}

            {conv.assigned_name && (
              <div className="flex items-center gap-1 mt-1.5">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">{conv.assigned_name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs text-gray-400">{timeAgo(conv.last_activity_at)}</span>
            {conv.has_pending_draft && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                Revisar borrador
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 mt-auto" />
          </div>
        </div>
      </div>
    </Link>
  )
}
