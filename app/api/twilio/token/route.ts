import 'server-only'
import { NextResponse } from 'next/server'
import { getToken } from '@/lib/api'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function POST() {
  try {
    await getToken() // validates session

    const accountSid  = process.env.TWILIO_ACCOUNT_SID!
    const authToken   = process.env.TWILIO_AUTH_TOKEN!
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!

    const token = new AccessToken(accountSid, authToken, authToken, {
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
