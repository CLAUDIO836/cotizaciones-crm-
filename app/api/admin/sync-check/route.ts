import { NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PD_BASE = 'https://api.pipedrive.com/v1'

async function pdGet(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${PD_BASE}${path}${sep}api_token=${PD_TOKEN}`)
  return r.json()
}

export async function GET() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Fetch all deals from Pipedrive
  const pdDeals: Array<{ id: number; title: string; status: string; value: number; update_time: string }> = []
  for (const status of ['open', 'won', 'lost']) {
    let start = 0
    while (true) {
      const res = await pdGet(`/deals?limit=500&start=${start}&status=${status}`)
      const data = res.data ?? []
      pdDeals.push(...data)
      if (!res.additional_data?.pagination?.more_items_in_collection) break
      start += 500
    }
  }

  // 2. Fetch all quotations from CRM
  const crmRes = await crmGet('quotations_summary', {}, token)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crmQuotations: Array<{ number: string; pipedrive_deal_id: string; status: string; total: number }> = (crmRes as any).data ?? []

  // 3. Build sets for comparison
  const pdIds = new Set(pdDeals.map(d => String(d.id)))
  const crmPdIds = new Set(crmQuotations.map(q => String(q.pipedrive_deal_id)).filter(Boolean))
  const crmNumbers = new Set(crmQuotations.map(q => String(q.number)))

  // In Pipedrive but not in CRM
  const inPdNotCrm = pdDeals.filter(d => !crmPdIds.has(String(d.id)) && !crmNumbers.has(String(d.id)))
  // In CRM but not in Pipedrive (pipedrive_deal_id set)
  const inCrmNotPd = crmQuotations.filter(q => q.pipedrive_deal_id && !pdIds.has(String(q.pipedrive_deal_id)))

  return NextResponse.json({
    pipedrive_total: pdDeals.length,
    crm_total: crmQuotations.length,
    in_pipedrive_not_crm: inPdNotCrm.map(d => ({ id: d.id, title: d.title, status: d.status, value: d.value })),
    in_crm_not_pipedrive: inCrmNotPd.map(q => ({ number: q.number, status: q.status, total: q.total })),
    matched: crmQuotations.filter(q => q.pipedrive_deal_id && pdIds.has(String(q.pipedrive_deal_id))).length,
  })
}
