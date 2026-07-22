import { NextResponse } from 'next/server'
import { crmGet, getToken } from '@/lib/api'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ hash: 'unauth' })

    // Consulta liviana: solo id, status, etapa, total de todas las cotizaciones activas
    const res = await crmGet('quotations_hash', {}, token)
    const data = res.data as { hash?: string; fingerprint?: string } | null

    // Si el backend devuelve hash directo, úsalo
    if (data && (data.hash || data.fingerprint)) {
      return NextResponse.json({ hash: data.hash ?? data.fingerprint })
    }

    // Fallback: calcular hash del payload completo
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex')
    return NextResponse.json({ hash })
  } catch {
    return NextResponse.json({ hash: 'error' })
  }
}
