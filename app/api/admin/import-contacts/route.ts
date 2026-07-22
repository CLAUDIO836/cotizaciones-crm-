import { NextResponse } from 'next/server'
import { crmPost, getToken } from '@/lib/api'

export async function POST() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await crmPost('contacts_import_from_quotations', {}, {}, token)
  return NextResponse.json(r)
}
