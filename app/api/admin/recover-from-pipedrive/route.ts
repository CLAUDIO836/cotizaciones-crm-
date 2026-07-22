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

    // 2. Obtener todos los deals de Pipedrive (paginado, incluye won/lost)
    const deals: Array<{ id: number; title: string; org_id: { value: number; name: string } | null }> = []
    for (const status of ['open', 'won', 'lost']) {
      let start = 0
      while (true) {
        const res = await pdGet(`/deals?limit=500&start=${start}&status=${status}`)
        const data = res.data ?? []
        deals.push(...data)
        if (!res.additional_data?.pagination?.more_items_in_collection) break
        start += 500
      }
    }

    // 3. Extraer nombre de cliente del título del deal
    // Formato: "CCL-46677 - 22/07/2026 - NOMBRE CLIENTE - dirección"
    function extractClientFromTitle(title: string): string {
      const parts = title.split(' - ')
      // parts[0] = "CCL-46677", parts[1] = "22/07/2026", parts[2] = cliente
      if (parts.length >= 3) return parts[2].trim()
      return ''
    }

    const dealMap = deals.map(d => ({
      pipedrive_deal_id: String(d.id),
      org_name: d.org_id?.name ?? extractClientFromTitle(d.title ?? ''),
      title: d.title ?? '',
    }))

    const r = await crmPost('restaurar_desde_pipedrive', { deals: dealMap }, {}, token)
    return NextResponse.json(r)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
