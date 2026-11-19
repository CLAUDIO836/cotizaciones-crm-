import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api'

export const dynamic = 'force-dynamic'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const dl = searchParams.get('download') === '1'

  const res = await fetch(
    `${CRM_API}?action=letters_download_comprobante&id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'
  const contentDispositionRaw = res.headers.get('Content-Disposition') ?? 'inline'
  const disposition = dl
    ? contentDispositionRaw.replace(/^inline/, 'attachment')
    : contentDispositionRaw

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store',
    },
  })
}
