import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return new NextResponse('Unauthorized', { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url || !url.includes('api.twilio.com')) {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  const audio = await res.arrayBuffer()
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
