import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PD_BASE  = 'https://api.pipedrive.com/v1'
const CRM_API  = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. ¿Existe la env var en producción?
  results.pd_token_present   = PD_TOKEN.length > 0
  results.pd_token_length    = PD_TOKEN.length
  results.pd_token_prefix    = PD_TOKEN ? PD_TOKEN.slice(0, 6) + '...' : 'EMPTY'
  results.crm_api_url        = CRM_API

  // 2. ¿El token sirve? Llamar a Pipedrive /users/me
  try {
    const pdRes = await fetch(`${PD_BASE}/users/me?api_token=${PD_TOKEN}`, { cache: 'no-store' })
    results.pd_api_status      = pdRes.status
    results.pd_api_reachable   = pdRes.ok
    const pdJson               = await pdRes.json()
    results.pd_user_name       = pdJson.data?.name ?? pdJson.error ?? null
  } catch (e) {
    results.pd_api_error       = String(e)
  }

  // 3. Estado real de deal 46663 en Pipedrive
  try {
    const d = await fetch(`${PD_BASE}/deals/46663?api_token=${PD_TOKEN}`, { cache: 'no-store' })
    const dj = await d.json()
    results.pd_deal_46663 = {
      status:      dj.data?.status,
      update_time: dj.data?.update_time,
      stage_id:    dj.data?.stage_id,
    }
  } catch (e) {
    results.pd_deal_46663_error = String(e)
  }

  // 4. Estado real de 46663 en CRM (directo a PHP)
  try {
    const crmRes = await fetch(
      `${CRM_API}?action=admin_fix_quotation&secret=transccl-admin-fix-2024`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '__find_46663__' }), cache: 'no-store' }
    )
    const crmJ = await crmRes.json()
    results.crm_46663 = crmJ.data?.all_rows?.[0] ?? null
  } catch (e) {
    results.crm_46663_error = String(e)
  }

  // 5. sync_log — últimas 5 entradas
  try {
    const logRes = await fetch(
      `${CRM_API}?action=admin_fix_quotation&secret=transccl-admin-fix-2024`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '__synclog_last5__' }), cache: 'no-store' }
    )
    const logJ = await logRes.json()
    results.sync_log_last5 = logJ.data ?? null
  } catch (e) {
    results.sync_log_error = String(e)
  }

  // 6. Probar PATCH real a Pipedrive (solo lectura — no cambia nada, usa GET)
  try {
    const testRes = await fetch(`${PD_BASE}/deals?api_token=${PD_TOKEN}&limit=1`, { cache: 'no-store' })
    results.pd_deals_list_status = testRes.status
  } catch (e) {
    results.pd_deals_list_error = String(e)
  }

  return NextResponse.json(results)
}
