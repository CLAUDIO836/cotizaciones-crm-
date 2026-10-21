import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import { createInstance, getInstanceStatus, getQRCode, instanceName } from '@/lib/evolution'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Admin can connect on behalf of any user, others connect themselves
  const body = await req.json().catch(() => ({}))
  const targetUserId: string = (user.role === 'admin' || user.role === 'superadmin')
    ? (body.userId ?? user.id)
    : user.id

  try {
    const status = await getInstanceStatus(targetUserId)

    if (status === 'not_created') {
      await createInstance(targetUserId, user.name)
    }

    if (status === 'open') {
      return NextResponse.json({ status: 'connected' })
    }

    const qrData = await getQRCode(targetUserId)
    const qrcode = qrData.qrcode?.base64 ?? qrData.base64 ?? null
    return NextResponse.json({
      status: 'qr',
      instance: instanceName(targetUserId),
      qrcode,
      raw: qrcode ? undefined : qrData,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[whatsapp/connect]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
