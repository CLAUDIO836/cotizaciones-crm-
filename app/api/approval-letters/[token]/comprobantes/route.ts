import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

// GET — listar comprobantes de una carta (público, solo con token)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const res = await fetch(`${CRM_API}?action=letters_get_comprobantes&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const json = await res.json()
  return NextResponse.json(json)
}

// POST — subir comprobante desde la página de la carta (público, solo con token)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const formData = await req.formData()
    const tipo = (formData.get('tipo') as string) ?? 'abono1'
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 10MB por archivo' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const b64 = buf.toString('base64')

    const montoRaw = (formData.get('monto') as string | null) ?? ''
    const amount = montoRaw ? parseInt(montoRaw.replace(/\D/g, ''), 10) || null : null

    const res = await fetch(`${CRM_API}?action=letters_save_comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        tipo,
        filename: file.name,
        data: b64,
        content_type: file.type || 'application/octet-stream',
        ...(amount ? { amount } : {}),
      }),
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json.error ?? 'Error al guardar' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
