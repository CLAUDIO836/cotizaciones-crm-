import 'server-only'
import { crmGet, getToken } from './api'
export type {
  CampaignStatus, ProspectStatus, ActivityType, ActivityResult,
  Campaign, ProspectContact, ProspectActivity, Prospect,
  CommuneAssignment, DashboardExecutive,
} from './prospectos-types'
export {
  STATUS_LABELS, STATUS_COLORS, ACTIVITY_LABELS, ACTIVITY_ICONS, RESULT_LABELS,
  daysSince, daysUntil,
} from './prospectos-types'
import type {
  Campaign, Prospect, CommuneAssignment, DashboardExecutive,
} from './prospectos-types'

// ── API helpers (server-only) ─────────────────────────────────────────────────

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
  call_cat?: string
}): Promise<Prospect[]> {
  const token = await getToken()
  const q: Record<string, string> = { campaign_id: params.campaign_id }
  if (params.status)   q.status   = params.status
  if (params.commune)  q.commune  = params.commune
  if (params.q)        q.q        = params.q
  if (params.call_cat) q.call_cat = params.call_cat
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
