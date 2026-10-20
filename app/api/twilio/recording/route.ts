import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { crmPost } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await req.formData()

  const callSid        = body.get('CallSid') as string
  const recordingUrl   = body.get('RecordingUrl') as string
  const recordingDuration = body.get('RecordingDuration') as string

  if (callSid && recordingUrl) {
    await crmPost('call_recording_update', {
      call_sid:         callSid,
      recording_url:    recordingUrl + '.mp3',
      recording_duration: recordingDuration ? parseInt(recordingDuration) : null,
    }).catch(() => {})
  }

  return new NextResponse('OK', { status: 200 })
}
