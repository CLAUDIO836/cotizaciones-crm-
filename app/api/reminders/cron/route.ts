import { NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

// Vercel Cron: runs Mon-Fri at 21:00 UTC = 18:00 Chile
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const r = await fetch(`${CRM_API}?action=send_pending_reminders&secret=transccl-cron-2024`, { cache: 'no-store' })
    const d = await r.json()
    console.log('[reminders/cron]', d)
    return NextResponse.json(d)
  } catch (e) {
    console.error('[reminders/cron]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
