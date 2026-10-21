import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse
const CRM_API = 'https://www.transccl.cl/crm-api.php'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const to       = body.get('To') as string | null
  // Twilio sends From as "client:{identity}" for browser calls
  const fromRaw  = (body.get('From') as string | null) ?? ''
  const userId   = fromRaw.startsWith('client:') ? fromRaw.slice(7) : null

  const twiml = new VoiceResponse()

  if (to) {
    // Registrar quién llamó a este número para routing de llamadas entrantes
    if (userId) {
      const secret = process.env.INTERNAL_PDF_SECRET
      const callSid = body.get('CallSid') as string | null
      if (secret) {
        fetch(`${CRM_API}?action=log_outbound_call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ user_id: userId, to_number: to, call_sid: callSid }),
        }).catch(() => {})
      }
    }

    const dial = twiml.dial({
      callerId: '+56229149664',
      record:    'record-from-answer',
      recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cotizaciones-crm.vercel.app'}/api/twilio/recording`,
      recordingStatusCallbackMethod: 'POST',
    })
    dial.number({}, to)
  } else {
    twiml.say({ language: 'es-MX' }, 'No se especificó un número de destino.')
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
