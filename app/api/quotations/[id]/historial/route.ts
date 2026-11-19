import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

export const dynamic = 'force-dynamic'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  try {
    const r = await fetch(
      `${CRM_API}?action=quotation_history_list&quotation_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    )
    const d = await r.json()
    return NextResponse.json(d)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
