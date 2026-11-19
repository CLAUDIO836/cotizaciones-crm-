import { NextRequest, NextResponse } from 'next/server'
import { crmGet, getToken, fetchPipelines } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
  try {
    const [r, pipelines] = await Promise.all([
      crmGet('quotations_summary', { client_id: clientId }, token),
      fetchPipelines(),
    ])
    const pipelineMap = Object.fromEntries(pipelines.map(p => [p.id, p.name]))
    const rows = ((r.data as Record<string, unknown>[]) ?? []).map(q => ({
      ...q,
      pipeline_name: q.pipeline_name ?? pipelineMap[q.pipeline_id as string] ?? null,
    }))
    return NextResponse.json({ data: rows })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
