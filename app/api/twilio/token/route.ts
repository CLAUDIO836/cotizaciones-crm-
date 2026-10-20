import 'server-only'
import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function POST() {
  try {
    await getToken() // validates session

    const accountSid  = process.env.TWILIO_ACCOUNT_SID
    const apiKey      = process.env.TWILIO_API_KEY
    const apiSecret   = process.env.TWILIO_API_SECRET
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return NextResponse.json({ error: 'Config incompleta' }, { status: 500 })
    }

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: 'crm-user',
      ttl: 3600,
    })

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    })
    token.addGrant(voiceGrant)

    return NextResponse.json({ token: token.toJwt() })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
