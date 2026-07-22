import { getToken } from '@/lib/api'
import { NextRequest, NextResponse } from 'next/server'

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_TOKEN ?? ''
const PIPEDRIVE_API   = 'https://api.pipedrive.com/v1'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { fileId } = await params

  // Obtener info del archivo en Pipedrive para conseguir la URL de descarga
  const infoRes = await fetch(`${PIPEDRIVE_API}/files/${fileId}?api_token=${PIPEDRIVE_TOKEN}`)
  if (!infoRes.ok) {
    return NextResponse.json({ error: 'Archivo no encontrado en Pipedrive' }, { status: 404 })
  }
  const info = await infoRes.json()
  const downloadUrl: string | undefined = info.data?.url

  if (!downloadUrl) {
    return NextResponse.json({ error: 'URL de descarga no disponible' }, { status: 404 })
  }

  // Proxy the PDF
  const fileRes = await fetch(downloadUrl)
  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Error al descargar desde Pipedrive' }, { status: 502 })
  }

  const buffer = await fileRes.arrayBuffer()
  const fileName = info.data?.name ?? `cotizacion-${fileId}.pdf`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
