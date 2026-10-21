import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { getInstanceStatus, getAllInstances } from '@/lib/evolution'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') ?? user.id

  const state = await getInstanceStatus(userId)
  return NextResponse.json({ state })
}

export async function POST() {
  const user = await getSession()
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const instances = await getAllInstances()
  return NextResponse.json({ instances })
}
