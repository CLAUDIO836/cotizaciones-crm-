import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const to   = body.get('To') as string | null

  const twiml = new VoiceResponse()

  if (to) {
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
