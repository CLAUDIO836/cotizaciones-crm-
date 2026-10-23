import { NextRequest, NextResponse } from 'next/server'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')
const ALLOWED_DOMAIN = 'transccl.cl'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const origin = req.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // Verificar que las credenciales de Google están configuradas
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google auth: GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados')
    return NextResponse.redirect(`${origin}/login?error=config`)
  }

  try {
    // 1. Intercambiar code por tokens de Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      console.error('Google auth: token exchange failed', tokens.error, tokens.error_description)
      return NextResponse.redirect(`${origin}/login?error=token`)
    }

    // 2. Obtener info del usuario de Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const googleUser = await userRes.json()
    const email: string = googleUser.email ?? ''
    const name: string = googleUser.name ?? email

    // 3. Validar dominio
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return NextResponse.redirect(`${origin}/login?error=domain`)
    }

    // 4. Buscar o crear perfil en CRM via PHP
    const crmRes = await fetch(`${CRM_API}?action=google_auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    })
    const crmJson = await crmRes.json()
    if (!crmRes.ok || !crmJson.data?.token) {
      console.error('Google auth: CRM auth failed', crmRes.status, crmJson)
      return NextResponse.redirect(`${origin}/login?error=crm`)
    }

    const { token } = crmJson.data

    // 5. Setear cookie y redirigir al dashboard
    const response = NextResponse.redirect(`${origin}/dashboard`)
    response.cookies.set('crm_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 72,
      path: '/',
    })
    return response
  } catch (e) {
    console.error('Google auth error:', e)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }
}
