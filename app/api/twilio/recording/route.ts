import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const callSid           = body.get('CallSid') as string | null
  const recordingUrl      = body.get('RecordingUrl') as string | null
  const recordingDuration = body.get('RecordingDuration') as string | null

  if (callSid && recordingUrl) {
    const secret = process.env.INTERNAL_PDF_SECRET ?? ''
    // Twilio puede enviar el SID del leg hijo; también enviamos ParentCallSid
    const parentCallSid = body.get('ParentCallSid') as string | null
    await fetch(`${CRM_API}?action=call_recording_update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({
        call_sid:            callSid,
        parent_call_sid:     parentCallSid,
        recording_url:       recordingUrl + '.mp3',
        recording_duration:  recordingDuration ? parseInt(recordingDuration) : null,
      }),
    }).catch(() => {})
  }

  return new NextResponse('OK', { status: 200 })
}
