import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import { getInstanceStatus, getAllInstances } from '@/lib/evolution'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ state: 'disconnected' })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') ?? ''
  if (!userId) return NextResponse.json({ state: 'disconnected' })

  const state = await getInstanceStatus(userId)
  return NextResponse.json({ state })
}

export async function POST() {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const instances = await getAllInstances()
  return NextResponse.json({ instances })
}
