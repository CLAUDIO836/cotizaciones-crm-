import { NextResponse } from 'next/server'

export async function GET() {
  const BASE = process.env.EVOLUTION_API_URL ?? ''
  const KEY  = process.env.EVOLUTION_API_KEY ?? ''

  if (!BASE) return NextResponse.json({ ok: false, error: 'EVOLUTION_API_URL no configurada' })

  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(BASE, {
      headers: { apikey: KEY },
      signal: ctrl.signal,
    })
    const text = await res.text()
    return NextResponse.json({ ok: res.ok, status: res.status, body: text.slice(0, 200), base: BASE })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e), base: BASE })
  }
}
