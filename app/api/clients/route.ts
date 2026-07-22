import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = req.nextUrl.searchParams.get('q')
  const id = req.nextUrl.searchParams.get('id')
  const rut = req.nextUrl.searchParams.get('rut')
  if (id) {
    const r = await crmGet('clients_get', { id }, token)
    return NextResponse.json(r)
  }
  if (rut) {
    const r = await crmGet('clients_by_rut', { rut }, token)
    return NextResponse.json(r)
  }
  if (q) {
    const r = await crmGet('clients_search', { q }, token)
    return NextResponse.json(r.data)
  }
  const r = await crmGet('clients_list', {}, token)
  return NextResponse.json(r.data)
}

export async function DELETE(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const r = await crmPost('clients_delete', { id }, {}, token)
  return NextResponse.json(r)
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  let action = 'clients_create'
  if (body._action === 'create_contact') action = 'contacts_create'
  else if (body.id) action = 'clients_update'
  const r = await crmPost(action, body, {}, token)
  return NextResponse.json(r)
}
