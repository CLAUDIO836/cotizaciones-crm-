import { cookies } from 'next/headers'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

export type UserSession = {
  id: string
  email: string
  name: string
  role: 'superadmin' | 'admin' | 'vendedor' | 'ejecutivo' | 'coordinador'
  created_at?: string
  celular?: string
}

// ── Token helpers (server-side) ───────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  const store = await cookies()
  return store.get('crm_token')?.value ?? null
}

export async function getSession(): Promise<UserSession | null> {
  const token = await getToken()
  if (!token) return null
  try {
    const res = await crmGet('me', {}, token)
    return (res.data as UserSession) ?? null
  } catch {
    return null
  }
}

// ── Low-level fetch ───────────────────────────────────────────────────────────

async function crmFetch(
  method: 'GET' | 'POST',
  action: string,
  queryParams: Record<string, string> = {},
  body?: unknown,
  token?: string | null,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const params = new URLSearchParams({ action, ...queryParams })
  if (token) params.set('token', token)
  const url = `${CRM_API}?${params}`

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

export async function crmGet(
  action: string,
  params: Record<string, string> = {},
  token?: string | null,
) {
  const tk = token ?? (await getToken())
  return crmFetch('GET', action, params, undefined, tk)
}

export async function crmPost(
  action: string,
  body: unknown,
  params: Record<string, string> = {},
  token?: string | null,
) {
  const tk = token ?? (await getToken())
  return crmFetch('POST', action, params, body, tk)
}

// ── Convenience data fetchers (used in Server Components) ─────────────────────

export async function fetchProfiles() {
  const r = await crmGet('profiles_list')
  return (r.data as UserSession[]) ?? []
}

export async function fetchClients() {
  const r = await crmGet('clients_list')
  return (r.data as Client[]) ?? []
}

export async function fetchPipelines(all = false) {
  const r = await crmGet('pipelines_list', all ? { all: '1' } : {})
  return (r.data as Pipeline[]) ?? []
}

export async function fetchCompanies() {
  const r = await crmGet('companies_list')
  return (r.data as Company[]) ?? []
}

export async function fetchQuotationsSummary(filters: Record<string, string> = {}) {
  const r = await crmGet('quotations_summary', filters)
  return (r.data as QuotationSummary[]) ?? []
}

export async function fetchQuotation(id: string, token?: string) {
  const r = await crmGet('quotations_get', { id }, token)
  return r.data as Quotation | null
}

export async function fetchActivities(quotationId: string) {
  const r = await crmGet('activities_list', { quotation_id: quotationId })
  return (r.data as Activity[]) ?? []
}

export async function fetchNotes(quotationId: string) {
  const r = await crmGet('notes_list', { quotation_id: quotationId })
  return (r.data as Note[]) ?? []
}

export async function fetchLeads() {
  const r = await crmGet('leads_list')
  return (r.data as LeadRequest[]) ?? []
}

export async function fetchContracts(filters: Record<string, string> = {}) {
  const r = await crmGet('contracts_list', filters)
  return (r.data as Contract[]) ?? []
}

export async function fetchContract(id: string) {
  const r = await crmGet('contracts_get', { id })
  return r.data as Contract | null
}

export async function fetchActivitiesAll(filters: Record<string, string> = {}) {
  const r = await crmGet('activities_list_all', filters)
  return (r.data as Activity[]) ?? []
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  rut?: string
  email?: string
  phone?: string
  address?: string
  contacto?: string
  telefono_fijo?: string
  telefono_celular?: string
  created_at?: string
}

export interface Pipeline {
  id: string
  name: string
  color: string
  active: boolean
  sort_order: number
}

export interface Company {
  id: string
  name: string
  slug: string
  color: string
}

export interface QuotationSummary {
  id: string
  number: string
  status: 'open' | 'won' | 'lost'
  etapa?: string
  company?: string
  company_id?: string
  total: number
  issue_date: string
  expiry_date?: string
  year?: number
  month?: number
  vendedor_id?: string
  vendedor_name?: string
  client_name?: string
  client_id?: string
  pipeline_id?: string
  pipeline_name?: string
  created_at?: string
}

export interface Quotation {
  id: string
  number: string
  status: 'open' | 'won' | 'lost'
  etapa?: string
  company?: string
  company_id?: string
  issue_date: string
  expiry_date?: string
  subtotal: number
  tax_pct: number
  total: number
  notes?: string
  terms?: string
  desde?: string
  hasta?: string
  distancia_km?: number
  fecha_salida?: string
  hora_salida?: string
  fecha_retorno?: string
  hora_retorno?: string
  fecha_destino?: string
  vehicle_type?: string
  observaciones?: string
  descuento_pct?: number
  contact_id?: string
  pipedrive_deal_id?: string
  user_id?: string
  client_id?: string
  pipeline_id?: string
  quotation_items?: QuotationItem[]
  clients?: Client
  profiles?: { name: string; email?: string }
  pipelines?: { name: string }
  client_name?: string
  client_rut?: string
  vendedor_id?: string
  profile_name?: string
  profile_email?: string
  pipeline_name?: string
  created_at?: string
}

export interface QuotationItem {
  id: string
  quotation_id: string
  codigo?: string
  description: string
  pasajeros?: number
  quantity: number
  unit_price: number
  subtotal: number
  sort_order: number
}

export interface Activity {
  id: string
  quotation_id?: string
  user_id?: string
  user_name?: string
  quotation_number?: string
  client_name?: string
  type: string
  subject: string
  note?: string
  due_date?: string
  done: boolean
  done_at?: string
  created_at?: string
}

export interface Note {
  id: string
  quotation_id?: string
  user_id?: string
  user_name?: string
  content: string
  created_at?: string
}

export interface LeadRequest {
  id: string
  status: string
  target_company?: string
  tipo_servicio?: string
  empresa_nombre?: string
  empresa_rut?: string
  contacto_nombre?: string
  contacto_cargo?: string
  contacto_email?: string
  contacto_telefono?: string
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
  crm_notes?: string
  assigned_user_id?: string
  profiles?: { name: string } | null
  ip_address?: string
  created_at: string
}

export interface Contract {
  id: string
  number: string
  status: 'active' | 'expired' | 'cancelled'
  start_date?: string
  end_date?: string
  value: number
  notes?: string
  user_id?: string
  client_id?: string
  quotation_id?: string
  clients?: { name: string; rut?: string; email?: string; phone?: string }
  profiles?: { name: string }
  quotations?: { number: string }
  created_at?: string
}
