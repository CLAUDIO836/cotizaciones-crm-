import { crmGet, crmPost, getToken } from './api'
import type { LeadRequest } from './api'

// ── Types ─────────────────────────────────────────────────────

export interface AiLandingStats {
  total_active: number
  ai_mode: number
  human_mode: number
  drafts_pending: number
  follow_ups_overdue: number
  ready_to_quote: number
  attention: number
}

export interface AiConversationSummary {
  id: string
  company_id?: string
  lead_id?: string
  client_id?: string
  status: 'active' | 'paused' | 'archived'
  mode: 'ai' | 'human'
  priority: 'high' | 'medium' | 'low'
  channel: string
  subject?: string
  assigned_user_id?: string
  assigned_name?: string
  company?: string
  empresa_nombre?: string
  contacto_nombre?: string
  client_name?: string
  latest_message?: string
  has_pending_draft: boolean
  tab_type?: 'lead' | 'seguimiento' | 'cotizar' | 'vencido'
  last_activity_at: string
  created_at: string
}

export interface AiMessage {
  id: string
  conversation_id: string
  sender: 'client' | 'ai' | 'human' | 'system'
  message_type: 'inbound' | 'draft' | 'sent' | 'note'
  content: string
  status: 'pending' | 'sent' | 'rejected'
  idempotency_key?: string
  approved_by?: string
  approved_at?: string
  rejected_by?: string
  rejected_at?: string
  rejection_note?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface AiTask {
  id: string
  conversation_id: string
  assigned_user_id?: string
  type: string
  due_date?: string
  done: boolean
  done_at?: string
  created_at: string
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: AiMessage[]
  tasks: AiTask[]
  // Lead fields joined directly from lead_requests
  empresa_rut?: string
  contacto_cargo?: string
  contacto_email?: string
  contacto_telefono?: string
  tipo_servicio?: string
  desde?: string
  hasta?: string
  pasajeros_aprox?: string | number
  fecha_inicio?: string
  observaciones?: string
  frecuencia?: string
  dias_semana?: string[]
  vehiculo_preferido?: string
  establecimiento_nombre?: string
  motivo_viaje?: string
  requiere_factura?: boolean
  target_company?: string
  // Client fields
  client_email?: string
  client_phone?: string
}

export interface AiAgentSettings {
  id: string
  company_id: string
  enabled: boolean
  model: string
  system_prompt?: string
  knowledge_base?: string
  temperature: number
  max_tokens: number
}

// ── Default values ────────────────────────────────────────────

const DEFAULT_STATS: AiLandingStats = {
  total_active: 0,
  ai_mode: 0,
  human_mode: 0,
  drafts_pending: 0,
  follow_ups_overdue: 0,
  ready_to_quote: 0,
  attention: 0,
}

// ── Fetch helpers (server-side) ───────────────────────────────

export async function fetchAiLandingStats(): Promise<AiLandingStats> {
  try {
    const r = await crmGet('ai_landing_stats')
    return (r.data as AiLandingStats) ?? DEFAULT_STATS
  } catch {
    return DEFAULT_STATS
  }
}

export async function fetchAiConversations(
  filters: Record<string, string> = {}
): Promise<AiConversationSummary[]> {
  try {
    const r = await crmGet('ai_conversations_list', filters)
    return (r.data as AiConversationSummary[]) ?? []
  } catch {
    return []
  }
}

export async function fetchAiConversation(
  id: string,
  token?: string | null
): Promise<AiConversationDetail | null> {
  try {
    const tk = token ?? (await getToken())
    const r = await crmGet('ai_conversations_get', { id }, tk)
    return (r.data as AiConversationDetail) ?? null
  } catch {
    return null
  }
}

export async function fetchAiAgentSettings(
  companyId?: string
): Promise<AiAgentSettings | null> {
  try {
    const params = companyId ? { company_id: companyId } : {}
    const r = await crmGet('ai_agent_settings_get', params)
    return (r.data as AiAgentSettings) ?? null
  } catch {
    return null
  }
}
