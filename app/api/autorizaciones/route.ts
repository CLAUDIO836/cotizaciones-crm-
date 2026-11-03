import { NextRequest, NextResponse } from 'next/server'
import { crmGet, crmPost, getToken } from '@/lib/api'

// Autorizaciones internas de precio. La lógica y los permisos (quién aprueba)
// viven en crm-api.php; aquí solo se pasa la sesión.

export async function GET(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('id')) return NextResponse.json(await crmGet('autz_get', { id: sp.get('id')! }, token))
    if (sp.get('count')) return NextResponse.json(await crmGet('autz_pending_count', {}, token))
    const params: Record<string, string> = { estado: sp.get('estado') ?? 'pendiente' }
    if (sp.get('mias')) params.mias = '1'
    return NextResponse.json(await crmGet('autz_list', params, token))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { _action, ...data } = body as { _action?: string } & Record<string, unknown>
  const action = { create: 'autz_create', decide: 'autz_decide', cancel: 'autz_cancel', reopen: 'autz_reopen' }[_action ?? '']
  if (!action) return NextResponse.json({ error: '_action debe ser create, decide, cancel o reopen' }, { status: 400 })
  try {
    return NextResponse.json(await crmPost(action, data, {}, token))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
