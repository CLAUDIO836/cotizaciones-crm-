import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

// Fires when the PSTN leg (child call inside <Dial>) completes.
// Twilio sends: CallSid=CHILD, ParentCallSid=PARENT, CallDuration, RecordingUrl, RecordingDuration
export async function POST(req: NextRequest) {
  const body = await req.formData()

  const parentCallSid    = body.get('ParentCallSid') as string | null
  const childCallSid     = body.get('CallSid')       as string | null
  const callDuration     = body.get('CallDuration')  as string | null
  const recordingUrl     = body.get('RecordingUrl')  as string | null
  const recordingDuration = body.get('RecordingDuration') as string | null

  // We need at least the parent SID to match outbound_calls
  if (!parentCallSid && !childCallSid) {
    return new NextResponse('OK', { status: 200 })
  }

  const secret = process.env.INTERNAL_PDF_SECRET ?? ''
  if (!secret) return new NextResponse('OK', { status: 200 })

  // Update outbound_calls by ParentCallSid (what's stored there)
  await fetch(`${CRM_API}?action=call_recording_update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({
      call_sid:            parentCallSid ?? childCallSid,
      parent_call_sid:     parentCallSid,
      recording_url:       recordingUrl ? recordingUrl + '.mp3' : null,
      recording_duration:  recordingDuration ? parseInt(recordingDuration) : null,
      call_duration:       callDuration ? parseInt(callDuration) : null,
    }),
  }).catch(() => {})

  return new NextResponse('OK', { status: 200 })
}
