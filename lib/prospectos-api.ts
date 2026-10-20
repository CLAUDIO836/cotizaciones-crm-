import { crmGet, crmPost, getToken } from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed'
export type ProspectStatus = 'new' | 'contacted' | 'following' | 'quoting' | 'closed_won' | 'closed_lost'
export type ActivityType   = 'call' | 'email' | 'whatsapp' | 'note' | 'visit'
export type ActivityResult = 'contacted' | 'no_answer' | 'interested' | 'not_interested' | 'follow_up' | 'quote_requested'

export type Campaign = {
  id: string
  name: string
  description: string | null
  segment: string
  region: string
  status: CampaignStatus
  created_by: string
  created_by_name: string
  created_at: string
  total_prospects: number
  contacted_count: number
  quoting_count: number
}

export type ProspectContact = {
  id: string
  prospect_id: string
  name: string
  role: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  is_primary: number
}

export type ProspectActivity = {
  id: string
  prospect_id: string
  contact_id: string | null
  user_id: string
  user_name: string
  contact_name: string | null
  type: ActivityType
  result: ActivityResult | null
  duration_sec: number | null
  recording_url: string | null
  notes: string | null
  next_contact: string | null
  created_at: string
}

export type Prospect = {
  id: string
  campaign_id: string
  name: string
  segment: string
  commune: string | null
  region: string
  rut: string | null
  rbd: string | null
  address: string | null
  assigned_to: string | null
  assigned_name: string | null
  status: ProspectStatus
  next_contact: string | null
  notes: string | null
  source: string
  created_at: string
  updated_at: string
  activity_count?: number
  last_activity_at?: string | null
  contacts?: ProspectContact[]
  activities?: ProspectActivity[]
  exception_user_id?: string | null
  exception_reason?: string | null
}

export type CommuneAssignment = {
  id: string
  campaign_id: string
  commune: string
  user_id: string
  user_name: string
  user_email: string
}

export type DashboardExecutive = {
  id: string
  name: string
  email: string
  total_assigned: number
  contacted: number
  quoting: number
  calls_period: number
  whatsapps_period: number
  emails_period: number
  call_seconds_period: number
}

// ── API helpers ───────────────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campaign[]> {
  const token = await getToken()
  const res = await crmGet('campaigns_list', {}, token)
  return (res.data as Campaign[]) ?? []
}

export async function fetchProspects(params: {
  campaign_id: string
  status?: string
  commune?: string
  q?: string
}): Promise<Prospect[]> {
  const token = await getToken()
  const q: Record<string, string> = { campaign_id: params.campaign_id }
  if (params.status)  q.status  = params.status
  if (params.commune) q.commune = params.commune
  if (params.q)       q.q       = params.q
  const res = await crmGet('prospects_list', q, token)
  return (res.data as Prospect[]) ?? []
}

export async function fetchProspect(id: string): Promise<Prospect | null> {
  const token = await getToken()
  const res = await crmGet('prospects_get', { id }, token)
  return (res.data as Prospect) ?? null
}

export async function fetchCommuneAssignments(campaign_id: string): Promise<CommuneAssignment[]> {
  const token = await getToken()
  const res = await crmGet('commune_assignments_list', { campaign_id }, token)
  return (res.data as CommuneAssignment[]) ?? []
}

export async function fetchCampaignCommunes(campaign_id: string): Promise<string[]> {
  const token = await getToken()
  const res = await crmGet('campaign_communes', { campaign_id }, token)
  return (res.data as string[]) ?? []
}

export async function fetchProspectosDashboard(params: {
  campaign_id?: string
  date_from?: string
  date_to?: string
}): Promise<{ executives: DashboardExecutive[], funnel: { status: string, cnt: number }[] }> {
  const token = await getToken()
  const q: Record<string, string> = {}
  if (params.campaign_id) q.campaign_id = params.campaign_id
  if (params.date_from)   q.date_from   = params.date_from
  if (params.date_to)     q.date_to     = params.date_to
  const res = await crmGet('prospectos_dashboard', q, token)
  return (res.data as { executives: DashboardExecutive[], funnel: { status: string, cnt: number }[] }) ?? { executives: [], funnel: [] }
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  new:          'Sin contactar',
  contacted:    'Contactado',
  following:    'En seguimiento',
  quoting:      'Cotizando',
  closed_won:   'Ganado',
  closed_lost:  'Perdido',
}

export const STATUS_COLORS: Record<ProspectStatus, string> = {
  new:          'bg-blue-100 text-blue-700',
  contacted:    'bg-gray-100 text-gray-600',
  following:    'bg-yellow-100 text-yellow-700',
  quoting:      'bg-purple-100 text-purple-700',
  closed_won:   'bg-green-100 text-green-700',
  closed_lost:  'bg-red-100 text-red-700',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call:      'Llamada',
  email:     'Email',
  whatsapp:  'WhatsApp',
  note:      'Nota',
  visit:     'Visita',
}

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  call:      '📞',
  email:     '✉️',
  whatsapp:  '💬',
  note:      '📝',
  visit:     '🏢',
}

export const RESULT_LABELS: Record<ActivityResult, string> = {
  contacted:        'Contactado',
  no_answer:        'No contestó',
  interested:       'Interesado',
  not_interested:   'No interesado',
  follow_up:        'Volver a llamar',
  quote_requested:  'Pidió cotización',
}

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
