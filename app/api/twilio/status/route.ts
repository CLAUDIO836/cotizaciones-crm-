import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { crmPost } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await req.formData()

  const callSid    = body.get('CallSid') as string
  const callStatus = body.get('CallStatus') as string
  const duration   = body.get('CallDuration') as string

  if (callSid) {
    await crmPost('call_status_update', {
      call_sid:  callSid,
      status:    callStatus,
      duration:  duration ? parseInt(duration) : null,
    }).catch(() => {})
  }

  return new NextResponse('OK', { status: 200 })
}
