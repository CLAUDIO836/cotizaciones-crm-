import 'server-only'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { deleteInstance } from '@/lib/evolution'

export async function POST() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await deleteInstance(user.id)
  return NextResponse.json({ ok: true })
}
