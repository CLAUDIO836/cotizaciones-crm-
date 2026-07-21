import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const quotation_id = req.nextUrl.searchParams.get('quotation_id') ?? ''
  const filter   = req.nextUrl.searchParams.get('filter') ?? ''
  const tipo     = req.nextUrl.searchParams.get('tipo') ?? ''
  const vendedor = req.nextUrl.searchParams.get('vendedor') ?? ''

  if (quotation_id) {
    const r = await crmGet('activities_list', { quotation_id }, token)
    return NextResponse.json(r.data)
  }
  // agenda view
  const params: Record<string, string> = {}
  if (filter)   params.filter   = filter
  if (tipo)     params.tipo     = tipo
  if (vendedor) params.vendedor = vendedor
  const r = await crmGet('activities_list_all', params, token)
  return NextResponse.json(r.data)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const action = body._action === 'update' ? 'activities_update' : 'activities_create'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r.data)
}
