import 'server-only'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const accountSid  = process.env.TWILIO_ACCOUNT_SID
    const apiKey      = process.env.TWILIO_API_KEY
    const apiSecret   = process.env.TWILIO_API_SECRET
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return NextResponse.json({ error: 'Config incompleta' }, { status: 500 })
    }

    // identity = userId para que el webhook sepa quién llama
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: session.id,
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
