import { NextResponse } from 'next/server'

export async function GET() {
  const envUrl = process.env.CRM_API_URL
  const usedUrl = envUrl ?? 'https://www.transccl.cl/crm-api.php'
  let phpResult = 'no probado'
  try {
    const res = await fetch(`${usedUrl}?action=google_auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'claudio@transccl.cl', name: 'Test' }),
    })
    const json = await res.json()
    phpResult = `HTTP ${res.status} — ok:${json.ok} token:${!!json.data?.token}`
  } catch (e) {
    phpResult = `EXCEPCION: ${e}`
  }
  return NextResponse.json({ CRM_API_URL_ENV: envUrl ?? '(no definida)', usedUrl, phpResult })
}
