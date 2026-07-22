import { NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PD_BASE = 'https://api.pipedrive.com/v1'

async function pdGet(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${PD_BASE}${path}${sep}api_token=${PD_TOKEN}`)
  return r.json()
}

export async function POST() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PD_TOKEN) return NextResponse.json({ error: 'PIPEDRIVE_API_TOKEN no configurado' }, { status: 500 })

  try {
    // 1. Obtener todas las organizaciones de Pipedrive para mapear org_id → nombre
    const orgsRes = await pdGet('/organizations?limit=500')
    const orgs: Record<number, { name: string }> = {}
    for (const o of orgsRes.data ?? []) {
      orgs[o.id] = { name: o.name }
    }

    // 2. Obtener todos los deals de Pipedrive (paginado)
    const deals: Array<{ id: number; org_id: { value: number; name: string } | null }> = []
    let start = 0
    while (true) {
      const res = await pdGet(`/deals?limit=500&start=${start}&status=all_not_deleted`)
      const data = res.data ?? []
      deals.push(...data)
      if (!res.additional_data?.pagination?.more_items_in_collection) break
      start += 500
    }

    // 3. Llamar al PHP para hacer el match y restaurar
    const dealMap = deals
      .filter(d => d.org_id)
      .map(d => ({
        pipedrive_deal_id: String(d.id),
        org_name: d.org_id?.name ?? '',
        org_id: d.org_id?.value ?? null,
      }))

    const r = await crmPost('restaurar_desde_pipedrive', { deals: dealMap }, {}, token)
    return NextResponse.json(r)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
