// Types, labels and pure helpers — safe to import in client components

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
  anexo: string | null
  call_instructions: string | null
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
  best_call_duration?: number | null
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

export type CallCategory = 'sin_llamar' | 'fallida' | 'fria' | 'contactado_call' | 'con_intencion'

export function classifyCall(duration: number | null | undefined): CallCategory {
  if (duration === null || duration === undefined) return 'sin_llamar'
  if (duration >= 60) return 'con_intencion'
  if (duration >= 15) return 'contactado_call'
  if (duration >= 5)  return 'fria'
  return 'fallida'
}

export const CALL_LABELS: Record<CallCategory, string> = {
  sin_llamar:    'Sin llamar',
  fallida:       'Fallida (0–4s)',
  fria:          'Fría (5–14s)',
  contactado_call: 'Contactado (15–59s)',
  con_intencion: 'Con intención (+60s)',
}

export const CALL_LABELS_SHORT: Record<CallCategory, string> = {
  sin_llamar:    'Sin llamar',
  fallida:       'Fallida',
  fria:          'Fría',
  contactado_call: 'Contactado',
  con_intencion: 'Con intención',
}

export const CALL_COLORS: Record<CallCategory, string> = {
  sin_llamar:    'bg-gray-100 text-gray-500',
  fallida:       'bg-red-100 text-red-700',
  fria:          'bg-orange-100 text-orange-700',
  contactado_call: 'bg-blue-100 text-blue-700',
  con_intencion: 'bg-green-100 text-green-700',
}

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
